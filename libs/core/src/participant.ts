import {
  ClientMessageSchema,
  ServerMessageSchema,
  VideoRequestSchema,
  type VideoAssignment,
  type StateUpdate,
  type VideoRequest,
  type Track,
  type ClientMessage,
  type ClientIntent,
  type UpstreamIntent,
  UpstreamIntentSchema,
  ClientIntentSchema,
} from "./gen/signaling_pb";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import type { PlatformAdapter } from "./platform";
import { EventEmitter } from "./event";
import { mapPresetToInternal, VIDEO_PRESETS, AUDIO_PRESETS, type VideoPreset, type VideoPresetName, type AudioPresetConfig, type AudioPresetName } from "./preset";

const SIGNALING_LABEL = "v1/sys/signaling";
const SYNC_DEBOUNCE_MS = 300;

/**
 * Maximum number of video slots available per session.
 * Each slot represents a simulcast video track that can be forwarded by the SFU.
 */
const MAX_VIDEO_SLOTS = 7;

/**
 * Maximum number of audio slots available per session.
 * Each slot represents an audio track that can be forwarded by the SFU.
 */
const MAX_AUDIO_SLOTS = 3;

/**
 * Configuration options for a participant connection.
 */
export interface ParticipantConfig {
  /**
   * Number of video slots to allocate for this participant.
   * Must be between 1 and {@link MAX_VIDEO_SLOTS} (default: {@link MAX_VIDEO_SLOTS}).
   */
  videoSlots?: number;

  /**
   * Number of audio slots to allocate for this participant.
   * Must be between 1 and {@link MAX_AUDIO_SLOTS} (default: {@link MAX_AUDIO_SLOTS}).
   */
  audioSlots?: number;

  /**
   * Base URL of the SFU signaling server.
   * @example "http://localhost:7070"
   */
  baseUrl?: string;

  /**
   * Authentication token for the participant session.
   * Passed as a Bearer token in the signaling handshake.
   */
  token?: string;

  /**
   * Arbitrary key-value metadata attached to the participant.
   * Forwarded as-is to other participants via the signaling layer.
   * @example { "displayName": "Alice", "role": "host" }
   */
  metadata?: Record<string, string>;
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
  [ParticipantEvent.LocalStreamUpdate]: { label: "main" | "aux" } & LocalStreamState;
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

const VIDEO_LAYERS = [0, 90, 180, 360, 540, 720, 1080];
function quantizeHeight(h: number): number {
  return VIDEO_LAYERS.find((l) => l >= h) ?? 1080;
}

export class RemoteVideoTrack {
  /** Target render height (px, quantized). The primary QoS lever. */
  public height: number = 0;
  /** Floor render height (px) to keep under contention; 0 = droppable. */
  public minHeight: number = 0;
  /** Contention importance; higher keeps/gains quality first. See VideoRequest. */
  public priority: number = 0;
  public paused: boolean = true;
  public onLayoutChange?: () => void;
  public onPausedChange?: (paused: boolean) => void;

  constructor(
    public readonly track: Track,
    public readonly stream: MediaStream
  ) { }

  get id() { return this.track.id; }
  get participantId() { return this.track.participantId; }

  setHeight(h: number) {
    const quantizedHeight = quantizeHeight(h);
    if (this.height === quantizedHeight) return;
    this.height = quantizedHeight;
    this.onLayoutChange?.();
  }

  /**
   * Lowest quality to keep for this stream under bandwidth contention. `0`
   * makes it droppable (may pause); set to a small value to keep it visible,
   * or to `height` to pin it at full quality. Quantized to a layer.
   */
  setMinHeight(h: number) {
    const quantized = quantizeHeight(h);
    if (this.minHeight === quantized) return;
    this.minHeight = quantized;
    this.onLayoutChange?.();
  }

  /**
   * Relative importance for bandwidth contention (higher = keeps/gains quality
   * first). Drive it from focus/active-speaker/etc. See `VideoRequest.priority`.
   */
  setPriority(p: number) {
    const priority = Math.max(0, Math.trunc(p));
    if (this.priority === priority) return;
    this.priority = priority;
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

class UpstreamState {
  localStream: LocalMediaStream | null = null;
  videoPreset: VideoPreset = VIDEO_PRESETS["motion"];
  audioPreset: AudioPresetConfig = AUDIO_PRESETS["speech"];
}

class Transport {
  readonly pc: RTCPeerConnection;
  readonly dc: RTCDataChannel;
  readonly videoSlots: RTCRtpTransceiver[] = [];
  readonly audioSlots: RTCRtpTransceiver[] = [];

  private mainVideoSender: RTCRtpSender;
  private mainAudioSender: RTCRtpSender;
  private auxVideoSender: RTCRtpSender;
  private auxAudioSender: RTCRtpSender;
  private mainVideoTransceiver: RTCRtpTransceiver;
  private auxVideoTransceiver: RTCRtpTransceiver;

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
      negotiated: false,
    });
    this.dc.binaryType = "arraybuffer";
    this.dc.onmessage = (ev) => onSignal(ev.data);

    this.mainAudioSender = this.pc.addTransceiver("audio", {
      direction: "sendonly",
    }).sender;

    this.mainVideoTransceiver = this.pc.addTransceiver("video", {
      direction: "sendonly",
      sendEncodings: [
        { rid: "f", active: true },
        { rid: "h", active: true },
        { rid: "q", active: true },
      ]
    });
    this.mainVideoSender = this.mainVideoTransceiver.sender;

    this.auxAudioSender = this.pc.addTransceiver("audio", {
      direction: "sendonly",
    }).sender;

    this.auxVideoTransceiver = this.pc.addTransceiver("video", {
      direction: "sendonly",
      sendEncodings: [
        { rid: "f", active: true },
        { rid: "h", active: true },
        { rid: "q", active: true },
      ]
    });
    this.auxVideoSender = this.auxVideoTransceiver.sender;

    const audioSlots = Math.min(config.audioSlots ?? MAX_AUDIO_SLOTS, MAX_AUDIO_SLOTS);
    for (let i = 0; i < audioSlots; i++) {
      this.audioSlots.push(this.pc.addTransceiver("audio", { direction: "recvonly" }));
    }
    const videoSlots = Math.min(config.videoSlots ?? MAX_VIDEO_SLOTS, MAX_VIDEO_SLOTS);
    for (let i = 0; i < videoSlots; i++) {
      this.videoSlots.push(this.pc.addTransceiver("video", { direction: "recvonly" }));
    }
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer.sdp;
  }

  async setAnswer(sdp: string) {
    await this.pc.setRemoteDescription({ type: "answer", sdp });
  }

  close() {
    this.pc.close();
    this.dc.close();
  }

  upstreamTrackStates(main: UpstreamState, aux: UpstreamState): UpstreamIntent[] {
    const pairs = [
      [this.mainVideoTransceiver, main] as const,
      [this.auxVideoTransceiver, aux] as const,
    ];

    const states: UpstreamIntent[] = [];
    for (const [tx, desired] of pairs) {
      if (!tx.mid) continue;
      states.push(create(UpstreamIntentSchema, {
        mid: tx.mid,
        // This is publisher intent, not an observation of the sender. A
        // freshly selected display track is the desired upstream state even
        // while replaceTrack() is still pending; using sender.track here
        // races the async replacement and can send an explicit active=false
        // for a screen share that the app just published.
        active: desired.localStream?.video !== null && desired.localStream?.video !== undefined,
      }));
    }
    states.sort((a, b) => a.mid.localeCompare(b.mid));
    return states;
  }

  sync(main: UpstreamState, aux: UpstreamState) {
    if (this.pc.signalingState === "closed") return;
    void syncSenderState(this.mainVideoSender, this.mainAudioSender, main);
    void syncSenderState(this.auxVideoSender, this.auxAudioSender, aux);
  }
}

/**
 * Reconciles one RTCRtpSender pair (video + audio) against the desired local
 * stream/preset state: swaps in the right physical track and applies the
 * preset's per-encoding config.
 */
export async function syncSenderState(
  videoSender: RTCRtpSender,
  audioSender: RTCRtpSender,
  desired: UpstreamState,
) {
  const vTrack = desired.localStream?.video?.track ?? null;
  const aTrack = desired.localStream?.audio?.track ?? null;

  // 1. Reconcile Physical Tracks
  if (videoSender.track !== vTrack) {
    await videoSender.replaceTrack(vTrack).catch((e) => {
      console.warn("video replaceTrack failed", e);
    });
  }
  if (audioSender.track !== aTrack) {
    await audioSender.replaceTrack(aTrack).catch((e) => {
      console.warn("audio replaceTrack failed", e);
    });
  }

  // 2. Reconcile Video Encodings
  try {
    const params = videoSender.getParameters();
    const internal = mapPresetToInternal(desired.videoPreset);
    const shouldBeActive = !!vTrack && !desired.localStream?.video?.muted;
    let changed = false;

    if (vTrack && "contentHint" in vTrack && vTrack.contentHint !== internal.contentHint) {
      vTrack.contentHint = internal.contentHint;
    }

    const encodingByRid = new Map<string, typeof internal.encodings[number]>(
      internal.encodings.map((encoding) => [encoding.rid, encoding]),
    );

    params.encodings.forEach((slot, i) => {
      const config = (slot.rid && encodingByRid.get(slot.rid)) ?? internal.encodings[i];
      if (!config) return;

      const active = shouldBeActive && !!config.active;
      changed = setSupportedParameter(slot, "active", active) || changed;
      changed = setSupportedParameter(slot, "scaleResolutionDownBy", config.scaleResolutionDownBy) || changed;
      changed = setSupportedParameter(slot, "maxBitrate", config.maxBitrate) || changed;
      changed = setSupportedParameter(slot, "maxFramerate", config.maxFramerate) || changed;
    });
    changed = setSupportedParameter(params, "degradationPreference", internal.degradationPreference) || changed;

    if (changed) {
      console.log(params);
      await videoSender.setParameters(params).catch((e) => {
        console.warn("video setParameters failed", e, params);
      });
    }
  } catch (e) { /* sender not yet negotiated */ }

  // 3. Reconcile Audio Preset
  if (aTrack && "contentHint" in aTrack && aTrack.contentHint !== desired.audioPreset.contentHint) {
    aTrack.contentHint = desired.audioPreset.contentHint;
  }
  try {
    const aParams = audioSender.getParameters();
    const aEncoding = aParams.encodings[0];
    let changed = false;
    if (aEncoding) {
      changed = setSupportedParameter(aEncoding, "maxBitrate", desired.audioPreset.maxBitrate) || changed;
      changed = setSupportedParameter(aEncoding, "dtx", desired.audioPreset.dtx) || changed;
    }
    if (changed) {
      await audioSender.setParameters(aParams).catch((e) => {
        console.warn("audio setParameters failed", e);
      });
    }
  } catch (e) { /* sender not yet negotiated */ }
}

function setSupportedParameter(
  parameters: object,
  key: string,
  value: unknown,
): boolean {
  const supported = parameters as Record<string, unknown>;
  if (supported[key] === value) return false;
  supported[key] = value;
  return true;
}

export interface PublishOptions {
  videoPreset?: VideoPresetName;
  audioPreset?: AudioPresetName;
}

export class StreamPublisher {
  private _state = new UpstreamState();

  constructor(
    private readonly _label: "main" | "aux",
    private readonly _onSync: () => void,
    private readonly _emitLocal: (label: "main" | "aux", state: LocalStreamState) => void,
  ) { }

  /** @internal */
  get _upstream(): UpstreamState { return this._state; }

  get audioMuted(): boolean { return this._state.localStream?.audio?.muted ?? false; }
  get videoMuted(): boolean { return this._state.localStream?.video?.muted ?? false; }

  publish(stream: MediaStream | null, options?: PublishOptions) {
    const resolvedVideo = VIDEO_PRESETS[options?.videoPreset ?? "motion"];
    const resolvedAudio = AUDIO_PRESETS[options?.audioPreset ?? "speech"];
    const internal = mapPresetToInternal(resolvedVideo);

    if (stream) {
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack && "contentHint" in vTrack) {
        vTrack.contentHint = internal.contentHint;
      }
      const aTrack = stream.getAudioTracks()[0];
      if (aTrack && "contentHint" in aTrack) {
        aTrack.contentHint = resolvedAudio.contentHint;
      }
      if (aTrack) {
        const targetChannels = resolvedAudio.stereo ? 2 : 1;
        aTrack.applyConstraints({ channelCount: { ideal: targetChannels } }).catch(() => { });
      }
    }

    this._state.videoPreset = resolvedVideo;
    this._state.audioPreset = resolvedAudio;
    this._state.localStream = stream ? new LocalMediaStream(stream) : null;
    this._onSync();
    this._emitLocal(this._label, { audioMuted: this.audioMuted, videoMuted: this.videoMuted });
  }

  unpublish() {
    this.publish(null);
  }

  mute(options: { video?: boolean; audio?: boolean }) {
    if (options.video !== undefined) {
      this._state.localStream?.video?.setMuted(options.video);
    }
    if (options.audio !== undefined) {
      this._state.localStream?.audio?.setMuted(options.audio);
    }
    this._onSync();
    this._emitLocal(this._label, { audioMuted: this.audioMuted, videoMuted: this.videoMuted });
  }
}

export class Participant extends EventEmitter<ParticipantEvents> {
  private session: SessionState;
  private transport: Transport | null = null;
  private _state: ConnectionState = "new";

  private lastSentRequests: VideoRequest[] = [];
  private lastSentUpstreamIntents: UpstreamIntent[] = [];

  private minPlayoutDelayMs = 0;
  private maxPlayoutDelayMs = 0;

  private debounceTimer: any | null = null;
  private isReconnecting = false;
  private retryCount = 0;
  private reconnectTimer: any = null;
  private ac = new AbortController();
  private generation = 0;

  public readonly main: StreamPublisher;
  public readonly aux: StreamPublisher;

  constructor(private adapter: PlatformAdapter, private config: ParticipantConfig) {
    super();
    this.session = new SessionState(adapter);
    this.session.on("track_added", (e) => this.emit(ParticipantEvent.VideoTrackAdded, e));
    this.session.on("track_removed", (e) => this.emit(ParticipantEvent.VideoTrackRemoved, e));
    this.session.on("update_needed", () => this.scheduleReconcile());

    const sync = () => {
      this.transport?.sync(this.main._upstream, this.aux._upstream);
      this.scheduleReconcile();
    };
    const emitLocal = (label: "main" | "aux", state: LocalStreamState) =>
      this.emit(ParticipantEvent.LocalStreamUpdate, { label, ...state });

    this.main = new StreamPublisher("main", sync, emitLocal);
    this.aux = new StreamPublisher("aux", sync, emitLocal);

  }

  get state() { return this._state; }
  get participantId() { return null; }

  connect(room: string) {
    if (this._state === "closed") throw new Error("Participant closed");
    if (this.session.resourceUri) {
      this.establishConnection("PATCH", this.session.resourceUri);
      return;
    }

    const baseUrl = this.config.baseUrl || "https://demo.pulsebeam.dev/api/v1";
    let uri = `${baseUrl}/rooms/${room}/participants?manual_sub=true`;

    if (this.config.metadata) {
      for (const [key, value] of Object.entries(this.config.metadata)) {
        uri += `&metadata.${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
    }

    this.establishConnection("POST", uri);
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
      if (this.config.token) {
        headers["Authorization"] = `Bearer ${this.config.token}`;
      }
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
      newTransport.sync(this.main._upstream, this.aux._upstream);

      // Reset the sent requests cache, as we have a fresh transport/session context
      this.lastSentRequests = [];
      this.lastSentUpstreamIntents = [];

      // Sync the state immediately to the new transport's reality
      this.updateState(newTransport.pc.connectionState);

      this.retryCount = 0;
      this.isReconnecting = false;

      this.transport.audioSlots.forEach(t => {
        const stream = new this.adapter.MediaStream([t.receiver.track]);
        this.emit(ParticipantEvent.AudioTrackAdded, { track: new RemoteAudioTrack(stream) });
      });

      // Re-apply the local jitter-buffer hint to the fresh receivers.
      this.applyJitterBufferTarget();

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
    const pausedTrackIds = new Set<string>();

    for (const slot of this.transport.videoSlots) {
      const mid = slot.mid;
      if (!mid) continue;

      const assign = this.session.assignments.get(mid);
      if (!assign || !this.session.tracks.has(assign.trackId)) continue;

      if (assign.paused) {
        pausedTrackIds.add(assign.trackId);
      } else {
        activeStreams.set(assign.trackId, slot.receiver.track);
      }
    }

    for (const rvt of this.session.remoteVideoTracks.values()) {
      const track = activeStreams.get(rvt.id);
      const isPaused = pausedTrackIds.has(rvt.id);

      if (rvt.paused !== isPaused) {
        rvt.paused = isPaused;
        rvt.onPausedChange?.(isPaused);
      }

      track ? rvt.setStream(track) : rvt.clearStream();
    }
  }

  private scheduleReconcile() {
    if (this.debounceTimer) this.adapter.clearTimeout(this.debounceTimer);
    this.debounceTimer = this.adapter.setTimeout(() => this.reconcile(), SYNC_DEBOUNCE_MS);
  }

  /**
   * Bound the receive-side latency for every remote stream (audio and video).
   * `maxMs` is a hard ceiling on the jitter buffer: the SFU enforces it across
   * the network via the `playout-delay` RTP extension, and we also hint the
   * local receivers. `minMs` raises the floor (usually 0). `maxMs === 0`
   * restores the browser's adaptive default.
   *
   * Lower `maxMs` = tighter, more consistent latency, but more concealment
   * under jitter/loss. Typical: ~80–150ms for interactive, higher for playback.
   */
  setLatency(maxMs: number, minMs = 0): void {
    const max = Math.max(0, Math.trunc(maxMs));
    const min = Math.min(Math.max(0, Math.trunc(minMs)), max > 0 ? max : Number.MAX_SAFE_INTEGER);
    if (max === this.maxPlayoutDelayMs && min === this.minPlayoutDelayMs) return;
    this.maxPlayoutDelayMs = max;
    this.minPlayoutDelayMs = min;
    this.applyJitterBufferTarget();
    this.reconcile(true);
  }

  private applyJitterBufferTarget(): void {
    if (!this.transport) return;
    // Soft, local hint biased toward the ceiling; the SFU's playout-delay
    // extension is the hard bound. `null` restores the adaptive default.
    const target = this.maxPlayoutDelayMs > 0 ? this.maxPlayoutDelayMs : null;
    for (const t of [...this.transport.videoSlots, ...this.transport.audioSlots]) {
      const receiver = t.receiver as RTCRtpReceiver & { jitterBufferTarget?: number | null };
      if (receiver && "jitterBufferTarget" in receiver) {
        try { receiver.jitterBufferTarget = target; } catch { /* unsupported browser */ }
      }
    }
  }

  private reconcile(force = false) {
    if (!this.transport || this.transport.dc.readyState !== "open") return;

    // 1. Declarative State: which tracks do we want, ranked by importance so the
    // most important win the limited downstream slots. Priority first, then the
    // rendered size as a tie-break.
    const desired = Array.from(this.session.remoteVideoTracks.values())
      .filter(v => v.height > 0)
      .sort((a, b) => b.priority - a.priority || b.height - a.height)
      .map(v => ({ id: v.id, height: v.height, minHeight: v.minHeight, priority: v.priority }));

    // 2. Resource State: What slots do we have, and what are they currently assigned to?
    const slotStates = this.transport.videoSlots
      .filter((s): s is RTCRtpTransceiver & { mid: string } => s.mid !== null)
      .map(s => ({
        mid: s.mid,
        currentTrackId: this.session.assignments.get(s.mid)?.trackId ?? null,
      }));

    // 3. Reconciliation Algorithm: Map Desired -> Resources (priority-aware eviction)
    const nextAssignments = computeVideoSlotAssignments(desired, slotStates);

    // 4. Construct Intent
    const requests: VideoRequest[] = [];
    for (const slot of this.transport.videoSlots) {
      const mid = slot.mid;
      if (!mid) continue;

      const assign = nextAssignments.get(mid);
      if (assign) {
        requests.push(create(VideoRequestSchema, {
          mid,
          trackId: assign.trackId,
          height: assign.height,
          minHeight: assign.minHeight,
          priority: assign.priority,
        }));
      }
    }

    const upstreamIntents = this.transport.upstreamTrackStates(this.main._upstream, this.aux._upstream);

    // 5. Differential Update
    if (
      !force
      && areRequestsEqual(this.lastSentRequests, requests)
      && areUpstreamIntentsEqual(this.lastSentUpstreamIntents, upstreamIntents)
    ) {
      return;
    }
    this.lastSentRequests = requests;
    this.lastSentUpstreamIntents = upstreamIntents;

    console.table(requests);
    const intent: ClientIntent = create(ClientIntentSchema, {
      downstreamRequests: requests,
      upstreamIntents,
      minPlayoutDelayMs: this.minPlayoutDelayMs,
      maxPlayoutDelayMs: this.maxPlayoutDelayMs,
    });
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

export interface DesiredVideoTrack {
  id: string;
  height: number;
  /** Floor to keep under contention; defaults to 0 (droppable). */
  minHeight?: number;
  /** Contention importance; defaults to 0. */
  priority?: number;
}

export interface VideoSlotAssignment {
  trackId: string;
  height: number;
  minHeight: number;
  priority: number;
}

export interface VideoSlotState {
  mid: string;
  currentTrackId: string | null;
}

/**
 * Maps desired video tracks to the limited set of downstream slots, evicting
 * lower-priority sticky assignments to make room for higher-priority ones
 * once slots are full.
 *
 * `desired` must already be sorted highest-priority-first (e.g. by height
 * descending). Only the top `slots.length` entries can ever win a slot.
 *
 * Two passes:
 *  1. Sticky - a slot keeps its current track if that track is still within
 *     the top-priority set, minimizing renegotiation/churn.
 *  2. Fill - remaining top-priority tracks (including ones just evicted from
 *     a slot given to something higher priority) take over any slot that
 *     didn't survive pass 1, i.e. slots freed from lower-priority tracks.
 */
export function computeVideoSlotAssignments(
  desired: DesiredVideoTrack[],
  slots: VideoSlotState[],
): Map<string, VideoSlotAssignment> {
  const capacity = slots.length;
  const top = desired.slice(0, capacity);
  const topById = new Map(top.map(t => [t.id, t]));

  const assign = (t: DesiredVideoTrack): VideoSlotAssignment => ({
    trackId: t.id,
    height: t.height,
    minHeight: t.minHeight ?? 0,
    priority: t.priority ?? 0,
  });

  const nextAssignments = new Map<string, VideoSlotAssignment>();
  const usedMids = new Set<string>();

  // Pass 1: Sticky assignments - keep a slot if its current track still
  // deserves one, instead of blindly keeping whatever it had before.
  for (const slot of slots) {
    const currentTrackId = slot.currentTrackId;
    const track = currentTrackId ? topById.get(currentTrackId) : undefined;
    if (track) {
      nextAssignments.set(slot.mid, assign(track));
      usedMids.add(slot.mid);
      topById.delete(track.id);
    }
  }

  // Pass 2: Fill slots freed from lower-priority tracks with the remaining
  // top-priority desired tracks (preserves priority order via Map insertion order).
  for (const track of topById.values()) {
    const freeSlot = slots.find(s => !usedMids.has(s.mid));
    if (!freeSlot) break;
    nextAssignments.set(freeSlot.mid, assign(track));
    usedMids.add(freeSlot.mid);
  }

  return nextAssignments;
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
      reqA.height !== reqB.height ||
      reqA.minHeight !== reqB.minHeight ||
      reqA.priority !== reqB.priority
    ) {
      return false;
    }
  }
  return true;
}

function areUpstreamIntentsEqual(
  a: UpstreamIntent[],
  b: UpstreamIntent[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const lhs = a[i];
    const rhs = b[i];
    if (!lhs || !rhs) return false;
    if (lhs.mid !== rhs.mid || lhs.active !== rhs.active) {
      return false;
    }
  }
  return true;
}
