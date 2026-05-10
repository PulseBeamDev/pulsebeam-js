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
import { mapPresetToInternal, VIDEO_PRESETS, AUDIO_PRESETS, type VideoPreset, type VideoPresetName, type AudioPresetConfig, type AudioPresetName } from "./preset";

const SIGNALING_LABEL = "__internal/v1/signaling";
const SYNC_DEBOUNCE_MS = 300;

/**
 * Maximum number of video slots available per session.
 * Each slot represents a simulcast video track that can be forwarded by the SFU.
 */
const MAX_VIDEO_SLOTS = 16;

/**
 * Maximum number of audio slots available per session.
 * Each slot represents an audio track that can be forwarded by the SFU.
 */
const MAX_AUDIO_SLOTS = 5;
const MAX_PUBLISH_VIDEO_SLOTS = 2;
const MAX_PUBLISH_AUDIO_SLOTS = 2;
const MAIN_PUBLISH_LABEL = "main";
const AUX_PUBLISH_LABEL = "aux";

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
  private readonly videoSenders: RTCRtpSender[] = [];
  private readonly audioSenders: RTCRtpSender[] = [];

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

    for (let i = 0; i < MAX_PUBLISH_AUDIO_SLOTS; i++) {
      this.audioSenders.push(this.pc.addTransceiver("audio", {
        direction: "sendonly",
      }).sender);
    }

    for (let i = 0; i < MAX_PUBLISH_VIDEO_SLOTS; i++) {
      this.videoSenders.push(this.pc.addTransceiver("video", {
        direction: "sendonly",
        sendEncodings: [
          { rid: "q", active: true },
          { rid: "h", active: true },
          { rid: "f", active: true },
        ]
      }).sender);
    }

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

  sync(publications: UpstreamPublication[]) {
    if (this.pc.signalingState === "closed") return;

    const desiredVideo: Array<UpstreamVideoDesired | null> = Array.from(
      { length: this.videoSenders.length },
      () => null
    );
    const desiredAudio: Array<UpstreamAudioDesired | null> = Array.from(
      { length: this.audioSenders.length },
      () => null
    );

    for (const publication of publications) {
      const vTrack = publication.localStream.video?.track ?? null;
      if (
        vTrack &&
        publication.videoSlot !== null &&
        publication.videoSlot >= 0 &&
        publication.videoSlot < desiredVideo.length
      ) {
        desiredVideo[publication.videoSlot] = {
          track: vTrack,
          preset: publication.videoPreset,
          muted: publication.localStream.video?.muted ?? false,
        };
      }

      const aTrack = publication.localStream.audio?.track ?? null;
      if (
        aTrack &&
        publication.audioSlot !== null &&
        publication.audioSlot >= 0 &&
        publication.audioSlot < desiredAudio.length
      ) {
        desiredAudio[publication.audioSlot] = {
          track: aTrack,
          preset: publication.audioPreset,
          muted: publication.localStream.audio?.muted ?? false,
        };
      }
    }

    for (let i = 0; i < this.videoSenders.length; i++) {
      const sender = this.videoSenders[i];
      if (!sender) continue;
      const desired = desiredVideo[i];
      const vTrack = desired?.track ?? null;

      if (sender.track !== vTrack) {
        sender.replaceTrack(vTrack).catch(() => { });
      }

      if (!desired) {
        continue;
      }

      try {
        const params = sender.getParameters();
        const internal = mapPresetToInternal(desired.preset);
        const shouldBeActive = !!vTrack && !desired.muted;
        let changed = false;

        if (vTrack && "contentHint" in vTrack && vTrack.contentHint !== internal.contentHint) {
          vTrack.contentHint = internal.contentHint;
        }

        params.encodings.forEach((slot, idx) => {
          const config = internal.encodings[idx];
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

        if (params.degradationPreference !== internal.degradationPreference) {
          params.degradationPreference = internal.degradationPreference;
          changed = true;
        }

        if (changed) {
          sender.setParameters(params).catch((e) => {
            console.warn("video setParameters failed, will retry on next sync", e);
          });
        }
      } catch (_e) {
        // Common if the sender is not yet negotiated or parameters aren't available
      }
    }

    for (let i = 0; i < this.audioSenders.length; i++) {
      const sender = this.audioSenders[i];
      if (!sender) continue;
      const desired = desiredAudio[i];
      const aTrack = desired?.track ?? null;

      if (sender.track !== aTrack) {
        sender.replaceTrack(aTrack).catch(() => { });
      }

      if (!desired) {
        continue;
      }

      if (aTrack && "contentHint" in aTrack && aTrack.contentHint !== desired.preset.contentHint) {
        aTrack.contentHint = desired.preset.contentHint;
      }

      try {
        const aParams = sender.getParameters();
        const aEncoding = aParams.encodings[0];
        let changed = false;
        if (aEncoding && aEncoding.maxBitrate !== desired.preset.maxBitrate) {
          aEncoding.maxBitrate = desired.preset.maxBitrate;
          changed = true;
        }
        if (aEncoding && aEncoding.dtx !== desired.preset.dtx) {
          aEncoding.dtx = desired.preset.dtx;
          changed = true;
        }
        if (aEncoding && aEncoding.active !== !desired.muted) {
          aEncoding.active = !desired.muted;
          changed = true;
        }
        if (changed) {
          sender.setParameters(aParams).catch((e) => {
            console.warn("audio setParameters failed, will retry on next sync", e);
          });
        }
      } catch (_e) {
        // Common if the sender is not yet negotiated or parameters aren't available
      }
    }
  }
}

export interface PublishOptions {
  videoPreset?: VideoPresetName;
  audioPreset?: AudioPresetName;
}

export interface StreamPublisher {
  publish: (stream: MediaStream, options?: PublishOptions) => void;
  unpublish: () => void;
}

interface UpstreamPublication {
  label: string;
  localStream: LocalMediaStream;
  videoPreset: VideoPreset;
  audioPreset: AudioPresetConfig;
  videoSlot: number | null;
  audioSlot: number | null;
}

interface UpstreamVideoDesired {
  track: MediaStreamTrack;
  preset: VideoPreset;
  muted: boolean;
}

interface UpstreamAudioDesired {
  track: MediaStreamTrack;
  preset: AudioPresetConfig;
  muted: boolean;
}

export class Participant extends EventEmitter<ParticipantEvents> {
  private session: SessionState;
  private transport: Transport | null = null;
  private _state: ConnectionState = "new";
  private upstreamPublications = new Map<string, UpstreamPublication>();
  public readonly main: StreamPublisher;
  public readonly aux: StreamPublisher;

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
    this.main = this.createPublisher(MAIN_PUBLISH_LABEL);
    this.aux = this.createPublisher(AUX_PUBLISH_LABEL);

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
    const s = this.getPrimaryPublication()?.localStream ?? null;
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
    let uri = `${baseUrl}/rooms/${room}/participants?manual_sub=true`;

    if (this.config.metadata) {
      for (const [key, value] of Object.entries(this.config.metadata)) {
        uri += `&metadata.${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
    }

    this.establishConnection("POST", uri);
  }

  publish(stream: MediaStream | null, options?: PublishOptions) {
    this.publishByLabel(MAIN_PUBLISH_LABEL, stream, options);
  }

  private publishByLabel(
    label: string,
    stream: MediaStream | null,
    options?: PublishOptions,
  ) {
    if (!stream) {
      this.unpublishByLabel(label);
      return;
    }

    const resolvedVideo = VIDEO_PRESETS[options?.videoPreset ?? "motion"];
    const resolvedAudio = AUDIO_PRESETS[options?.audioPreset ?? "speech"];
    const internal = mapPresetToInternal(resolvedVideo);

    const nextLocal = new LocalMediaStream(stream);
    const needsVideoSlot = !!nextLocal.video;
    const needsAudioSlot = !!nextLocal.audio;

    const publication = this.upstreamPublications.get(label);
    const videoSlot = this.reserveSlot(
      publication?.videoSlot ?? null,
      needsVideoSlot,
      MAX_PUBLISH_VIDEO_SLOTS,
      (entry) => entry.label !== label ? entry.videoSlot : null,
      "video",
    );
    const audioSlot = this.reserveSlot(
      publication?.audioSlot ?? null,
      needsAudioSlot,
      MAX_PUBLISH_AUDIO_SLOTS,
      (entry) => entry.label !== label ? entry.audioSlot : null,
      "audio",
    );

    if (nextLocal.video?.track && "contentHint" in nextLocal.video.track) {
      nextLocal.video.track.contentHint = internal.contentHint;
    }
    if (nextLocal.audio?.track && "contentHint" in nextLocal.audio.track) {
      nextLocal.audio.track.contentHint = resolvedAudio.contentHint;
    }
    if (nextLocal.audio?.track) {
      const targetChannels = resolvedAudio.stereo ? 2 : 1;
      nextLocal.audio.track
        .applyConstraints({ channelCount: { ideal: targetChannels } })
        .catch(() => { });
    }

    this.upstreamPublications.set(label, {
      label,
      localStream: nextLocal,
      videoPreset: resolvedVideo,
      audioPreset: resolvedAudio,
      videoSlot,
      audioSlot,
    });

    this.transport?.sync(Array.from(this.upstreamPublications.values()));
    this.emit(ParticipantEvent.LocalStreamUpdate, this.local);
  }

  unpublish() {
    this.unpublishByLabel(MAIN_PUBLISH_LABEL);
  }

  private unpublishByLabel(label: string) {
    if (!this.upstreamPublications.delete(label)) {
      return;
    }
    this.transport?.sync(Array.from(this.upstreamPublications.values()));
    this.emit(ParticipantEvent.LocalStreamUpdate, this.local);
  }

  mute(options: { video?: boolean; audio?: boolean }) {
    const publication = this.getPrimaryPublication();
    if (!publication) {
      return;
    }

    if (options.video !== undefined) {
      publication.localStream.video?.setMuted(options.video);
    }
    if (options.audio !== undefined) {
      publication.localStream.audio?.setMuted(options.audio);
    }

    // Update transport flow and notify UI
    this.transport?.sync(Array.from(this.upstreamPublications.values()));
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
      newTransport.sync(Array.from(this.upstreamPublications.values()));

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

  private createPublisher(label: string): StreamPublisher {
    return {
      publish: (stream, options) => this.publishByLabel(label, stream, options),
      unpublish: () => this.unpublishByLabel(label),
    };
  }

  private getPrimaryPublication(): UpstreamPublication | null {
    return this.upstreamPublications.get(MAIN_PUBLISH_LABEL)
      ?? this.upstreamPublications.values().next().value
      ?? null;
  }

  private reserveSlot(
    currentSlot: number | null,
    needed: boolean,
    maxSlots: number,
    slotSelector: (entry: UpstreamPublication) => number | null,
    kind: "video" | "audio",
  ): number | null {
    if (!needed) {
      return null;
    }

    if (currentSlot !== null) {
      return currentSlot;
    }

    const used = new Set<number>();
    for (const entry of this.upstreamPublications.values()) {
      const slot = slotSelector(entry);
      if (slot !== null) {
        used.add(slot);
      }
    }

    for (let i = 0; i < maxSlots; i++) {
      if (!used.has(i)) {
        return i;
      }
    }

    throw new Error(`No available ${kind} publish slots`);
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
