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

const SIGNALING_LABEL = "__internal/v1/signaling";
const SYNC_DEBOUNCE_MS = 300;

export interface ParticipantConfig {
  videoSlots: number;
  audioSlots: number;
  baseUrl?: string;
}

export type ConnectionState = RTCPeerConnectionState;

// Public Events
export const ParticipantEvent = {
  State: "state",
  VideoTrackAdded: "video_track_added",
  VideoTrackRemoved: "video_track_removed",
  AudioTrackAdded: "audio_track_added",
  AudioTrackRemoved: "audio_track_removed",
  Error: "error",
} as const;

export interface ParticipantEvents {
  [ParticipantEvent.State]: ConnectionState;
  [ParticipantEvent.VideoTrackAdded]: { track: RemoteVideoTrack };
  [ParticipantEvent.VideoTrackRemoved]: { trackId: string };
  [ParticipantEvent.AudioTrackAdded]: { track: RemoteAudioTrack };
  [ParticipantEvent.AudioTrackRemoved]: { trackId: string };
  [ParticipantEvent.Error]: Error;
}

// Internal Session Events
type SessionEvents = {
  "track_added": { track: RemoteVideoTrack };
  "track_removed": { trackId: string };
  "update_needed": {};
}

export class RemoteAudioTrack {
  constructor(public readonly stream: MediaStream) { }
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
      sendEncodings: PRESET_CAMERA,
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

  updateLocalStream(stream: MediaStream | null) {
    const videoTrack = stream?.getVideoTracks()[0] ?? null;
    const audioTrack = stream?.getAudioTracks()[0] ?? null;

    this.videoSender.replaceTrack(videoTrack).catch(e => console.error("Failed to replace video", e));
    this.audioSender.replaceTrack(audioTrack).catch(e => console.error("Failed to replace audio", e));

    const params = this.videoSender.getParameters();
    let hasChanges = false;
    const shouldBeActive = !!videoTrack;
    for (const enc of params.encodings) {
      if (enc.active !== shouldBeActive) {
        enc.active = shouldBeActive;
        hasChanges = true;
      }
    }
    if (hasChanges) {
      this.videoSender.setParameters(params).catch(e => console.error("Failed to update params", e));
    }
  }

  close() {
    this.pc.close();
    this.dc.close();
  }
}

export class Participant extends EventEmitter<ParticipantEvents> {
  private session: SessionState;
  private transport: Transport | null = null;
  private _state: ConnectionState = "new";

  private localStream: MediaStream | null = null;
  private lastSentRequests: VideoRequest[] = [];

  private debounceTimer: any | null = null;
  private isReconnecting = false;
  private retryCount = 0;
  private reconnectTimer: any = null;

  constructor(private adapter: PlatformAdapter, private config: ParticipantConfig) {
    super();
    this.session = new SessionState(adapter);

    this.session.on("track_added", (e) => this.emit(ParticipantEvent.VideoTrackAdded, e));
    this.session.on("track_removed", (e) => this.emit(ParticipantEvent.VideoTrackRemoved, e));
    this.session.on("update_needed", () => this.scheduleReconcile());
  }

  get state() { return this._state; }
  get participantId() { return null; }

  async connect(room: string) {
    if (this._state === "closed") throw new Error("Participant closed");
    const baseUrl = this.config.baseUrl || "https://demo.pulsebeam.dev/api/v1";
    const uri = `${baseUrl}/rooms/${room}/participants?manual_sub=true`;
    await this.establishConnection("POST", uri);
  }

  publish(stream: MediaStream | null) {
    this.localStream = stream;
    this.transport?.updateLocalStream(stream);
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

    newTransport.updateLocalStream(this.localStream);

    try {
      try {
        const caps = this.adapter.getCapabilities?.("video");
        const prefs = caps?.codecs?.filter(c =>
          c.mimeType.toLowerCase() === "video/h264" &&
          c.sdpFmtpLine?.includes("packetization-mode=1") &&
          c.sdpFmtpLine?.includes("profile-level-id=42001f")
        );
        if (prefs?.length) {
          newTransport.pc.getTransceivers().forEach(t => {
            if (t.receiver.track.kind === "video") t.setCodecPreferences(prefs);
          });
        }
      } catch (e) { /* ignore */ }

      const sdp = await newTransport.createOffer();

      const res = await this.adapter.fetch(uri, {
        method,
        headers: { "Content-Type": "application/sdp" },
        body: sdp,
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Session expired");
        throw new Error(`Connection failed: ${res.status}`);
      }

      if (method === "POST") {
        this.session.resourceUri = res.headers.get("Location");
        if (!this.session.resourceUri) throw new Error("Missing Location header");
      }

      await newTransport.setAnswer(await res.text());

      // ATOMIC SWAP: The new transport is ready.
      if (this.transport) this.transport.close();
      this.transport = newTransport;

      // Sync the state immediately to the new transport's reality
      this.updateState(newTransport.pc.connectionState);

      this.retryCount = 0;
      this.isReconnecting = false;

      this.transport.audioSlots.forEach(t => {
        const stream = new this.adapter.MediaStream([t.receiver.track]);
        this.emit(ParticipantEvent.AudioTrackAdded, { track: new RemoteAudioTrack(stream) });
      });

      this.routePhysicalToVirtual();
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
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
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
          this.scheduleReconcile();
          this.routePhysicalToVirtual();
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

const PRESET_CAMERA: RTCRtpEncodingParameters[] = [
  { rid: "q", scaleResolutionDownBy: 4, maxBitrate: 150_000, active: false },
  { rid: "h", scaleResolutionDownBy: 2, maxBitrate: 400_000, active: false },
  { rid: "f", scaleResolutionDownBy: 1, maxBitrate: 1_250_000, active: false },
];

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
