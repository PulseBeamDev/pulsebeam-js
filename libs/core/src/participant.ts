import { map, type MapStore } from "nanostores";
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
  isPublishing: boolean;
  videoMuted: boolean;
  audioMuted: boolean;
}

export interface ParticipantState extends LocalStreamState {
  connectionState: ConnectionState;
  videoTracks: RemoteVideoTrack[];
  audioTracks: RemoteAudioTrack[];
  error: Error | null;
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

class SessionState {
  resourceUri: string | null = null;
  etag: string | null = null;
  seq: bigint = 0n;
  tracks: Map<string, Track> = new Map();
  assignments: Map<string, VideoAssignment> = new Map();
  remoteVideoTracks: Map<string, RemoteVideoTrack> = new Map();

  constructor(
    private adapter: PlatformAdapter,
    private callbacks: {
      onTrackChange: () => void;
      onLayoutChange: () => void;
    }
  ) { }

  getOrCreateVideoTrack(trackData: Track): RemoteVideoTrack {
    let remoteTrack = this.remoteVideoTracks.get(trackData.id);
    if (!remoteTrack) {
      const stream = new this.adapter.MediaStream();
      remoteTrack = new RemoteVideoTrack(trackData, stream);
      remoteTrack.onLayoutChange = () => this.callbacks.onLayoutChange();
      this.remoteVideoTracks.set(remoteTrack.id, remoteTrack);
      this.callbacks.onTrackChange();
    }
    return remoteTrack;
  }

  removeTrack(id: string) {
    const track = this.remoteVideoTracks.get(id);
    if (track) {
      track.clearStream();
      this.remoteVideoTracks.delete(id);
      this.callbacks.onTrackChange();
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
        { rid: "q", active: false },
        { rid: "h", active: false },
        { rid: "f", active: false },
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

  async applyVideoPreset(preset: VideoPreset) {
    const { encodings, degradationPreference } = mapPresetToInternal(preset);
    const params = this.videoSender.getParameters();

    params.degradationPreference = degradationPreference;
    params.encodings.forEach((slot, i) => {
      const config = encodings[i];
      if (!config) {
        return;
      }

      if (config.maxBitrate) {
        slot.maxBitrate = config.maxBitrate;
      }

      if (config.maxFramerate) {
        slot.maxBitrate = config.maxFramerate;
      }

      slot.scaleResolutionDownBy = config.scaleResolutionDownBy;
    });

    await this.videoSender.setParameters(params);
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
}

export class Participant {
  public readonly state: MapStore<ParticipantState>;

  private _localStream: LocalMediaStream | null = null;
  private session: SessionState;
  private transport: Transport | null = null;

  private lastSentRequests: VideoRequest[] = [];

  private debounceTimer: any | null = null;
  private isReconnecting = false;
  private retryCount = 0;
  private reconnectTimer: any = null;

  constructor(private adapter: PlatformAdapter, private config: ParticipantConfig) {
    this.state = map<ParticipantState>({
      connectionState: "new",
      isPublishing: false,
      videoMuted: false,
      audioMuted: false,
      videoTracks: [],
      audioTracks: [],
      error: null
    });

    this.session = new SessionState(adapter, {
      onTrackChange: () => {
        this.state.setKey("videoTracks", Array.from(this.session.remoteVideoTracks.values()));
      },
      onLayoutChange: () => {
        this.scheduleReconcile();
      }
    });
  }

  get participantId() { return null; }

  connect(room: string) {
    if (this.state.get().connectionState === "closed") throw new Error("Participant closed");
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

    this._localStream = stream ? new LocalMediaStream(stream) : null;

    if (this.transport) {
      this.transport.applyVideoPreset(resolved);
      this.transport.updateLocalStream(this._localStream);
    }

    this.updateLocalState();
  }

  mute(options: { video?: boolean; audio?: boolean }) {
    if (options.video !== undefined) {
      this._localStream?.video?.setMuted(options.video);
    }
    if (options.audio !== undefined) {
      this._localStream?.audio?.setMuted(options.audio);
    }

    // Update transport flow and notify UI
    this.transport?.updateLocalStream(this._localStream);
    this.updateLocalState();
  }

  close() {
    if (this.reconnectTimer) this.adapter.clearTimeout(this.reconnectTimer);
    if (this.debounceTimer) this.adapter.clearTimeout(this.debounceTimer);

    if (this.session.resourceUri) {
      this.adapter.fetch(this.session.resourceUri, { method: "DELETE" }).catch(() => { });
    }

    this.transport?.close();
    this.updateState("closed");
  }

  private updateLocalState() {
    this.state.setKey("isPublishing", !!this._localStream);
    this.state.setKey("audioMuted", this._localStream?.audio?.muted ?? false);
    this.state.setKey("videoMuted", this._localStream?.video?.muted ?? false);
  }

  private async establishConnection(method: "POST" | "PATCH", uri: string) {
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

    newTransport.updateLocalStream(this._localStream);

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

      this.session.resourceUri = res.headers.get("Location");
      if (!this.session.resourceUri) throw new Error("Missing Location header");

      this.session.etag = res.headers.get("ETag");
      if (!this.session.etag) throw new Error("Missing ETag header");

      await newTransport.setAnswer(await res.text());

      // ATOMIC SWAP: The new transport is ready.
      if (this.transport) this.transport.close();
      this.transport = newTransport;

      // Sync the state immediately to the new transport's reality
      this.updateState(newTransport.pc.connectionState);

      this.retryCount = 0;
      this.isReconnecting = false;

      const audioTracks = this.transport.audioSlots.map(t => {
        return new RemoteAudioTrack(new this.adapter.MediaStream([t.receiver.track]));
      });
      this.state.setKey("audioTracks", audioTracks);

    } catch (e) {
      newTransport.close();
      if (!this.isReconnecting) {
        this.updateState("failed");
        this.state.setKey("error", e instanceof Error ? e : new Error(String(e)));
      }
      throw e;
    }
  }

  private updateState(newState: ConnectionState) {
    if (this.state.get().connectionState === newState) return;
    this.state.setKey("connectionState", newState);
  }

  private handleTransportState(state: ConnectionState) {
    if (state === "failed" || state === "disconnected") {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isReconnecting || this.state.get().connectionState === "closed") return;

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
          this.state.setKey("error", new Error("Reconnection exhausted"));
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

    const desired = Array.from(this.session.remoteVideoTracks.values())
      .filter(v => v.height > 0)
      .sort((a, b) => b.height - a.height);

    const nextAssignments = new Map<string, { trackId: string, height: number }>();
    const usedMids = new Set<string>();

    for (const slot of this.transport.videoSlots) {
      const mid = slot.mid;
      if (!mid) continue;
      const current = this.session.assignments.get(mid);
      if (current) {
        const vSlot = this.session.remoteVideoTracks.get(current.trackId);
        if (vSlot && desired.includes(vSlot)) {
          nextAssignments.set(mid, { trackId: vSlot.id, height: vSlot.height });
          usedMids.add(mid);
          desired.splice(desired.indexOf(vSlot), 1);
        }
      }
    }

    for (const vSlot of desired) {
      const free = this.transport.videoSlots.find(s => s.mid && !usedMids.has(s.mid));
      if (free) {
        nextAssignments.set(free.mid!, { trackId: vSlot.id, height: vSlot.height });
        usedMids.add(free.mid!);
      }
    }

    const requests: VideoRequest[] = [];
    for (const slot of this.transport.videoSlots) {
      const mid = slot.mid;
      if (!mid) continue;
      const assign = nextAssignments.get(mid);
      if (assign) {
        requests.push(create(VideoRequestSchema, { mid, trackId: assign.trackId, height: assign.height }));
      }
    }

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
