import {
  ClientMessageSchema,
  ServerMessageSchema,
  ClientIntentSchema,
  VideoRequestSchema,
  type VideoAssignment,
  type StateUpdate,
  type VideoRequest,
  type Track,
  type ClientMessage,
} from "./gen/signaling_pb";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import type { PlatformAdapter } from "./platform";
import { EventEmitter } from "./event";
import { mapPresetToInternal, PRESETS, type VideoPreset } from "./preset";

const SIGNALING_LABEL = "__internal/v1/signaling";
const SYNC_DEBOUNCE_MS = 300;

export interface ParticipantConfig {
  videoSlots: number;
  audioSlots: number;
  baseUrl?: string;
}

export type ConnectionState = RTCPeerConnectionState;

export interface LocalStreamState {
  videoMuted: boolean;
  audioMuted: boolean;
}

// Public Events
export const ParticipantEvent = {
  State: "state",
  VideoTrackAdded: "video_track_added",
  VideoTrackRemoved: "video_track_removed",
  AudioTrackAdded: "audio_track_added",
  AudioTrackRemoved: "audio_track_removed",
  LocalStreamUpdate: "local_stream_update",
  Error: "error",
} as const;

export interface ParticipantEvents {
  [ParticipantEvent.State]: ConnectionState;
  [ParticipantEvent.VideoTrackAdded]: { track: RemoteVideoTrack };
  [ParticipantEvent.VideoTrackRemoved]: { trackId: string };
  [ParticipantEvent.AudioTrackAdded]: { track: RemoteAudioTrack };
  [ParticipantEvent.AudioTrackRemoved]: { trackId: string };
  [ParticipantEvent.LocalStreamUpdate]: LocalStreamState;
  [ParticipantEvent.Error]: Error;
}

// Internal Session Events
type SessionEvents = {
  "track_added": { track: RemoteVideoTrack };
  "track_removed": { trackId: string };
  "update_needed": {};
}

export class LocalTrack {
  constructor(
    public readonly track: MediaStreamTrack,
  ) { }

  get id() { return this.track.id; }
  get kind() { return this.track.kind; }
  get muted() { return !this.track.enabled; }

  setMuted(muted: boolean) {
    if (this.track.enabled === !muted) return;
    this.track.enabled = !muted;
  }
}

export class LocalMediaStream {
  public readonly video: LocalTrack | null;
  public readonly audio: LocalTrack | null;

  constructor(
    public readonly stream: MediaStream,
  ) {
    const v = stream.getVideoTracks()[0];
    const a = stream.getAudioTracks()[0];
    this.video = v ? new LocalTrack(v) : null;
    this.audio = a ? new LocalTrack(a) : null;
  }
}

export class RemoteAudioTrack {
  constructor(public readonly stream: MediaStream) { }

  get id() { return this.stream.id; }
}

export class RemoteVideoTrack {
  public height: number = 0;
  public onLayoutChange?: () => void;

  constructor(
    public readonly track: Track,
    public readonly stream: MediaStream
  ) { }

  get id() { return this.track.id; }
  get participantId() { return this.track.participantId; }

  setHeight(h: number) {
    const layers = [0, 90, 180, 360, 540, 720, 1080];
    const quantizedHeight = layers.find((l) => l >= h) ?? 1080;

    if (this.height === quantizedHeight) return;
    this.height = quantizedHeight;
    this.onLayoutChange?.();
  }

  setStream(track: MediaStreamTrack) {
    const current = this.stream.getVideoTracks()[0];
    if (current && current.id === track.id) return;
    this.clearStream();
    this.stream.addTrack(track);
  }

  clearStream() {
    this.stream.getTracks().forEach((t) => this.stream.removeTrack(t));
  }
}

class SessionState extends EventEmitter<SessionEvents> {
  resourceUri: string | null = null;
  etag: string | null = null;
  seq: bigint = 0n;
  tracks: Map<string, Track> = new Map();
  assignments: Map<string, VideoAssignment> = new Map();
  remoteVideoTracks: Map<string, RemoteVideoTrack> = new Map();

  constructor(private adapter: PlatformAdapter) {
    super();
  }

  getOrCreateVideoTrack(trackData: Track): RemoteVideoTrack {
    let remoteTrack = this.remoteVideoTracks.get(trackData.id);
    if (!remoteTrack) {
      const stream = new this.adapter.MediaStream();
      remoteTrack = new RemoteVideoTrack(trackData, stream);
      remoteTrack.onLayoutChange = () => this.emit("update_needed", {});
      this.remoteVideoTracks.set(remoteTrack.id, remoteTrack);
      this.emit("track_added", { track: remoteTrack });
    }
    return remoteTrack;
  }

  removeTrack(id: string) {
    const track = this.remoteVideoTracks.get(id);
    if (track) {
      track.clearStream();
      this.remoteVideoTracks.delete(id);
      this.emit("track_removed", { trackId: id });
    }
    this.tracks.delete(id);
  }

  applyUpdate(u: StateUpdate) {
    const seq = u.seq;

    if (u.isSnapshot) {
      console.info("received a snapshot");
      const incomingIds = new Set(u.tracksUpsert.map((t) => t.id));
      for (const id of this.tracks.keys()) {
        if (!incomingIds.has(id)) this.removeTrack(id);
      }
      this.assignments.clear();
    }

    u.tracksRemove.forEach((id) => this.removeTrack(id));
    u.tracksUpsert.forEach((t) => {
      if (!this.tracks.has(t.id) && !this.remoteVideoTracks.has(t.id)) {
        this.getOrCreateVideoTrack(t);
      }
      this.tracks.set(t.id, t);
    });

    u.assignmentsRemove.forEach((mid) => this.assignments.delete(mid));
    u.assignmentsUpsert.forEach((a) => this.assignments.set(a.mid, a));

    this.seq = seq;
  }
}

class Transport {
  readonly pc: RTCPeerConnection;
  readonly dc: RTCDataChannel;
  readonly videoSlots: RTCRtpTransceiver[] = [];
  readonly audioSlots: RTCRtpTransceiver[] = [];

  private videoSender: RTCRtpSender;
  private audioSender: RTCRtpSender;

  upstreamState = new UpstreamState();

  constructor(
    private adapter: PlatformAdapter,
    config: ParticipantConfig,
    onSignal: (data: ArrayBuffer) => void,
    onState: (state: ConnectionState) => void
  ) {
    this.pc = new this.adapter.RTCPeerConnection();
    this.pc.onconnectionstatechange = () => onState(this.pc.connectionState);

    this.dc = this.pc.createDataChannel(SIGNALING_LABEL, {
      ordered: true,
      negotiated: true,
      id: 0,
    });
    this.dc.binaryType = "arraybuffer";
    this.dc.onmessage = (ev) => onSignal(ev.data);

    for (let i = 0; i < config.videoSlots; i++) {
      this.videoSlots.push(this.pc.addTransceiver("video", { direction: "recvonly" }));
    }
    for (let i = 0; i < config.audioSlots; i++) {
      this.audioSlots.push(this.pc.addTransceiver("audio", { direction: "recvonly" }));
    }

    this.videoSender = this.pc.addTransceiver("video", {
      direction: "sendonly",
      sendEncodings: [
        { rid: "q", active: true },
        { rid: "h", active: true },
        { rid: "f", active: true },
      ]
    }).sender;

    this.audioSender = this.pc.addTransceiver("audio", {
      direction: "sendonly",
    }).sender;
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer.sdp;
  }

  async setAnswer(sdp: string) {
    await this.pc.setRemoteDescription({ type: "answer", sdp });
  }

  updateLocalStream(local: LocalMediaStream | null) {
    const vTrack = local?.video?.track ?? null;
    const aTrack = local?.audio?.track ?? null;

    // Swap the actual hardware tracks
    this.videoSender.replaceTrack(vTrack);
    this.audioSender.replaceTrack(aTrack);

    const params = this.videoSender.getParameters();
    const shouldBeActive = !!vTrack && !local?.video?.muted;

    let changed = false;
    params.encodings.forEach(enc => {
      if (enc.active !== shouldBeActive) {
        enc.active = shouldBeActive;
        changed = true;
      }
    });

    if (changed) {
      this.videoSender.setParameters(params).catch(() => { });
    }
  }

  close() {
    this.pc.close();
    this.dc.close();
  }

  sync(desired: UpstreamState) {
    if (this.pc.signalingState === "closed") return;

    const vTrack = desired.localStream?.video?.track ?? null;
    const aTrack = desired.localStream?.audio?.track ?? null;

    // 1. Reconcile Physical Tracks
    if (this.videoSender.track !== vTrack) {
      this.videoSender.replaceTrack(vTrack).catch(() => { });
    }
    if (this.audioSender.track !== aTrack) {
      this.audioSender.replaceTrack(aTrack).catch(() => { });
    }

    // 2. Reconcile RtpParameters (Encodings & Bitrates)
    try {
      const params = this.videoSender.getParameters();
      const internal = mapPresetToInternal(desired.preset);
      const shouldBeActive = !!vTrack && !desired.localStream?.video?.muted;
      let changed = false;

      // Update contentHint if it has changed
      if (vTrack && "contentHint" in vTrack && vTrack.contentHint !== internal.contentHint) {
        vTrack.contentHint = internal.contentHint;
      }

      // Reconcile encodings
      params.encodings.forEach((slot, i) => {
        const config = internal.encodings[i];
        if (!config) return;

        if (slot.active !== shouldBeActive) {
          slot.active = shouldBeActive;
          changed = true;
        }
        if (slot.scaleResolutionDownBy !== config.scaleResolutionDownBy) {
          slot.scaleResolutionDownBy = config.scaleResolutionDownBy;
          changed = true;
        }
        if (slot.maxBitrate !== config.maxBitrate) {
          slot.maxBitrate = config.maxBitrate;
          changed = true;
        }
        if (slot.maxFramerate !== config.maxFramerate) {
          slot.maxFramerate = config.maxFramerate;
          changed = true;
        }
      });

      // Reconcile degradation preference
      if (params.degradationPreference !== internal.degradationPreference) {
        params.degradationPreference = internal.degradationPreference;
        changed = true;
      }

      if (changed) {
        this.videoSender.setParameters(params).catch((e) => {
          console.warn("setParameters failed, will retry on next sync", e);
        });
      }
    } catch (e) {
      // Common if the sender is not yet negotiated or parameters aren't available
    }
  }
}

class UpstreamState {
  localStream: LocalMediaStream | null = null;
  preset: VideoPreset = PRESETS["camera"];
}

export class Participant extends EventEmitter<ParticipantEvents> {
  private session: SessionState;
  private transport: Transport | null = null;
  private _state: ConnectionState = "new";
  private upstreamState = new UpstreamState();

  private lastSentRequests: VideoRequest[] = [];

  private debounceTimer: any | null = null;
  private isReconnecting = false;
  private retryCount = 0;
  private reconnectTimer: any = null;
  private ac = new AbortController();
  private generation = 0;

  constructor(private adapter: PlatformAdapter, private config: ParticipantConfig) {
    super();
    this.session = new SessionState(adapter);

    this.session.on("track_added", (e) => this.emit(ParticipantEvent.VideoTrackAdded, e));
    this.session.on("track_removed", (e) => this.emit(ParticipantEvent.VideoTrackRemoved, e));
    this.session.on("update_needed", () => this.scheduleReconcile());
  }

  get state() { return this._state; }
  get participantId() { return null; }

  /**
   * Snapshot of current local media state for UI binding.
   */
  get local(): LocalStreamState {
    const s = this.upstreamState.localStream;
    return {
      audioMuted: s?.audio?.muted ?? false,
      videoMuted: s?.video?.muted ?? false,
    };
  }

  connect(room: string) {
    if (this._state === "closed") throw new Error("Participant closed");
    if (this.session.resourceUri) {
      this.establishConnection("PATCH", this.session.resourceUri);
      return;
    }

    const baseUrl = this.config.baseUrl || "https://demo.pulsebeam.dev/api/v1";
    const uri = `${baseUrl}/rooms/${room}/participants?manual_sub=true`;
    this.establishConnection("POST", uri);
  }

  /**
   * Replaces the current stream. Pass null to unpublish.
   */
  publish(stream: MediaStream | null, preset: VideoPreset | "camera" | "screen" = "camera") {
    const resolved = typeof preset === "string" ? PRESETS[preset] : preset;
    const internal = mapPresetToInternal(resolved);

    if (stream) {
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack && "contentHint" in vTrack) {
        vTrack.contentHint = internal.contentHint;
      }
    }

    this.upstreamState.localStream = stream ? new LocalMediaStream(stream) : null;
    this.transport?.sync(this.upstreamState);

    this.emit(ParticipantEvent.LocalStreamUpdate, this.local);
  }

  mute(options: { video?: boolean; audio?: boolean }) {
    if (options.video !== undefined) {
      this.upstreamState.localStream?.video?.setMuted(options.video);
    }
    if (options.audio !== undefined) {
      this.upstreamState.localStream?.audio?.setMuted(options.audio);
    }

    // Update transport flow and notify UI
    this.transport?.sync(this.upstreamState);
    this.emit(ParticipantEvent.LocalStreamUpdate, this.local);
  }

  close() {
    this.ac.abort();

    if (this.reconnectTimer) this.adapter.clearTimeout(this.reconnectTimer);
    if (this.debounceTimer) this.adapter.clearTimeout(this.debounceTimer);
    if (this.session.resourceUri) {
      this.adapter.fetch(this.session.resourceUri, { method: "DELETE" }).catch(() => { });
      this.session.resourceUri = null;
    }

    this.transport?.close();
    this.updateState("closed");
  }

  private async establishConnection(method: "POST" | "PATCH", uri: string) {
    const generation = ++this.generation;

    // We do NOT update this.transport yet. We build the new one in isolation.
    const newTransport = new Transport(
      this.adapter,
      this.config,
      (data) => this.handleSignal(data),
      (state) => {
        // Only update the public state if this transport is the active one.
        // This allows 'newTransport' to go through "new"->"connecting" without
        // causing UI flicker if we are currently "connected" via the old transport.
        if (this.transport === newTransport) {
          this.updateState(state);
          this.handleTransportState(state);
        }
      }
    );

    try {
      const sdp = await newTransport.createOffer();

      const headers: Record<string, string> = {
        "Content-Type": "application/sdp"
      };
      if (this.session.etag) {
        headers["If-Match"] = this.session.etag;
      }
      const res = await this.adapter.fetch(uri, {
        method,
        body: sdp,
        headers,
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Session expired");
        throw new Error(`Connection failed: ${res.status}`);
      }

      const location = res.headers.get("Location");
      const etag = res.headers.get("ETag");
      if (!location) {
        throw new Error("Missing Location header");
      }
      if (!etag) {
        throw new Error("Missing ETag header");
      }

      // this can happen when close is called during the fetch.
      if (this.ac.signal.aborted || generation != this.generation) {
        this.adapter.fetch(location, { method: "DELETE" }).catch(() => { });
        return;
      }

      this.session.resourceUri = location;
      this.session.etag = etag;

      await newTransport.setAnswer(await res.text());

      if (this.ac.signal.aborted || generation !== this.generation) {
        this.adapter.fetch(location, { method: "DELETE" }).catch(() => { });
        newTransport.close();
        return;
      }

      // ATOMIC SWAP: The new transport is ready.
      if (this.transport) this.transport.close();
      this.transport = newTransport;
      newTransport.sync(this.upstreamState);

      // Reset the sent requests cache, as we have a fresh transport/session context
      this.lastSentRequests = [];

      // Sync the state immediately to the new transport's reality
      this.updateState(newTransport.pc.connectionState);

      this.retryCount = 0;
      this.isReconnecting = false;

      this.transport.audioSlots.forEach(t => {
        const stream = new this.adapter.MediaStream([t.receiver.track]);
        this.emit(ParticipantEvent.AudioTrackAdded, { track: new RemoteAudioTrack(stream) });
      });

      // Immediately reconcile to ensure declarative state matches the new transport
      this.reconcile(true);

    } catch (e) {
      newTransport.close();
      if (!this.isReconnecting) {
        this.updateState("failed");
      }
      throw e;
    }
  }

  private updateState(newState: ConnectionState) {
    if (this._state === newState) return;
    this._state = newState;
    this.emit(ParticipantEvent.State, newState);
  }

  private handleTransportState(state: ConnectionState) {
    if (state === "failed" || state === "disconnected") {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isReconnecting || this._state === "closed") return;

    if (!this.session.resourceUri) {
      throw new Error("unexpected missing resourceUri");
    }

    const resourceUri = this.session.resourceUri;
    const delay = this.retryCount === 0 ? 0 :
      this.retryCount === 1 ? 500 :
        Math.min(500 * Math.pow(2, this.retryCount - 1), 5000);
    this.retryCount++;

    if (this.reconnectTimer) this.adapter.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = this.adapter.setTimeout(() => {
      this.isReconnecting = true;
      this.establishConnection("PATCH", resourceUri).catch(e => {
        console.warn("Reconnect attempt failed", e);
        this.isReconnecting = false;
        if (this.retryCount > 5) {
          this.emit(ParticipantEvent.Error, new Error("Reconnection exhausted"));
          this.close();
        } else {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private handleSignal(data: ArrayBuffer) {
    try {
      const msg = fromBinary(ServerMessageSchema, new Uint8Array(data));
      if (msg.payload.case === "update") {
        const u = msg.payload.value;
        if (!u.isSnapshot && (u.seq > this.session.seq + 1n)) {
          this.sendSyncRequest();
        } else if (u.isSnapshot || u.seq > this.session.seq) {
          this.session.applyUpdate(u);
          this.routePhysicalToVirtual();
          if (u.isSnapshot) {
            // if we received a snapshot, the state has been drifted. 
            // We should reconcile immediately to recover the UI.
            this.reconcile(true);
          } else {
            this.scheduleReconcile();
          }
        }
      } else if (msg.payload.case === "error") {
        console.error("SFU Error:", msg.payload.value);
      }
    } catch (e) {
      console.warn("Proto decode failed", e);
    }
  }

  private routePhysicalToVirtual() {
    if (!this.transport) return;
    const activeStreams = new Map<string, MediaStreamTrack>();

    for (const slot of this.transport.videoSlots) {
      const mid = slot.mid;
      if (!mid) continue;

      const assign = this.session.assignments.get(mid);
      if (assign && !assign.paused && this.session.tracks.has(assign.trackId)) {
        activeStreams.set(assign.trackId, slot.receiver.track);
      }
    }

    for (const rvt of this.session.remoteVideoTracks.values()) {
      const track = activeStreams.get(rvt.id);
      track ? rvt.setStream(track) : rvt.clearStream();
    }
  }

  private scheduleReconcile() {
    if (this.debounceTimer) this.adapter.clearTimeout(this.debounceTimer);
    this.debounceTimer = this.adapter.setTimeout(() => this.reconcile(), SYNC_DEBOUNCE_MS);
  }

  private reconcile(force = false) {
    if (!this.transport || this.transport.dc.readyState !== "open") return;

    // 1. Declarative State: What tracks do we want? (Sorted by priority)
    const desired = Array.from(this.session.remoteVideoTracks.values())
      .filter(v => v.height > 0)
      .sort((a, b) => b.height - a.height);

    // 2. Resource State: What slots do we have?
    const nextAssignments = new Map<string, { trackId: string, height: number }>();
    const usedMids = new Set<string>();

    // 3. Reconciliation Algorithm: Map Desired -> Resources

    // Pass 1: Sticky Assignments.
    // If a slot is currently assigned to a track we still want, keep it.
    for (const slot of this.transport.videoSlots) {
      const mid = slot.mid;
      if (!mid) continue;

      const currentAssign = this.session.assignments.get(mid);
      if (currentAssign) {
        const vSlot = this.session.remoteVideoTracks.get(currentAssign.trackId);
        // If this track is in our desired list, keep the assignment
        if (vSlot && desired.includes(vSlot)) {
          nextAssignments.set(mid, { trackId: vSlot.id, height: vSlot.height });
          usedMids.add(mid);
          // Remove from desired list so we don't assign it again
          desired.splice(desired.indexOf(vSlot), 1);
        }
      }
    }

    // Pass 2: New Assignments.
    // For remaining desired tracks, find the first free slot.
    for (const vSlot of desired) {
      const freeSlot = this.transport.videoSlots.find(s => s.mid && !usedMids.has(s.mid));
      if (freeSlot) {
        nextAssignments.set(freeSlot.mid!, { trackId: vSlot.id, height: vSlot.height });
        usedMids.add(freeSlot.mid!);
      } else {
        // No more slots available. Stop assigning.
        break;
      }
    }

    // 4. Construct Intent
    const requests: VideoRequest[] = [];
    for (const slot of this.transport.videoSlots) {
      const mid = slot.mid;
      if (!mid) continue;

      const assign = nextAssignments.get(mid);
      if (assign) {
        requests.push(create(VideoRequestSchema, { mid, trackId: assign.trackId, height: assign.height }));
      }
    }

    // 5. Differential Update
    if (!force && areRequestsEqual(this.lastSentRequests, requests)) return;
    this.lastSentRequests = requests;

    console.table(requests);
    const intent = create(ClientIntentSchema, { requests });
    this.send({ case: "intent", value: intent });
  }

  private sendSyncRequest() {
    this.send({ case: "requestSync", value: true });
  }

  private send(payload: ClientMessage["payload"]) {
    if (!this.transport || this.transport.dc.readyState !== "open") {
      console.warn("dropped a payload because data channel is not ready:", payload);
      return;
    }
    const msg = create(ClientMessageSchema, { payload });
    this.transport.dc.send(toBinary(ClientMessageSchema, msg));
  }
}

function areRequestsEqual(a: VideoRequest[], b: VideoRequest[]): boolean {
  if (a.length !== b.length) return false;
  // Sort by MID to ensure deterministic comparison
  const sA = [...a].sort((x, y) => x.mid.localeCompare(y.mid));
  const sB = [...b].sort((x, y) => x.mid.localeCompare(y.mid));
  for (let i = 0; i < sA.length; i++) {
    const reqA = sA[i];
    const reqB = sB[i];

    if (!reqA || !reqB) return false;

    if (
      reqA.mid !== reqB.mid ||
      reqA.trackId !== reqB.trackId ||
      reqA.height !== reqB.height
    ) {
      return false;
    }
  }
  return true;
}
