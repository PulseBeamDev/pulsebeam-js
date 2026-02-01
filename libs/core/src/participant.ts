import {
  ClientMessageSchema,
  ServerMessageSchema,
  ClientIntentSchema,
  VideoRequestSchema,
  type VideoAssignment,
  type StateUpdate,
  type VideoRequest,
  type Track,
} from "./gen/signaling_pb";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import type { PlatformAdapter } from "./platform";
import { EventEmitter } from "./event";

const SIGNALING_LABEL = "__internal/v1/signaling";
const SYNC_DEBOUNCE_MS = 300;

enum HeaderExt {
  ParticipantId = "pb-participant-id",
}

export interface ParticipantConfig {
  videoSlots: number;
  audioSlots: number;
}

export type ConnectionState = RTCPeerConnectionState;

export const ParticipantEvent = {
  State: "state",
  VideoTrackAdded: "video_track_added",
  VideoTrackRemoved: "video_track_removed",
  AudioTrackAdded: "audio_track_added",
  AudioTrackRemoved: "audio_track_removed",
  Error: "error",
} as const;

export interface ParticipantEvents {
  [ParticipantEvent.State]: ConnectionState,
  [ParticipantEvent.VideoTrackAdded]: { track: RemoteVideoTrack };
  [ParticipantEvent.VideoTrackRemoved]: { trackId: string };
  [ParticipantEvent.AudioTrackAdded]: { track: RemoteAudioTrack };
  [ParticipantEvent.AudioTrackRemoved]: { trackId: string };
  [ParticipantEvent.Error]: Error,
}

export class RemoteAudioTrack {
  constructor(
    public readonly stream: MediaStream
  ) { }
}

export class RemoteVideoTrack {
  public height: number = 0;
  public onLayoutChange?: () => void;

  constructor(
    public readonly track: Track,
    public readonly stream: MediaStream
  ) { }

  get id() {
    return this.track.id;
  }

  get participantId() {
    return this.track.participantId;
  }

  setHeight(h: number) {
    const layers = [0, 90, 180, 360, 540, 720, 1080];
    // Find the smallest layer that is >= the observed height
    const quantizedHeight = layers.find(l => l >= h) ?? 1080;

    if (this.height === quantizedHeight) return;
    this.height = quantizedHeight;
    this.onLayoutChange?.();
  }

  setStream(track: MediaStreamTrack) {
    this.stream.getTracks().forEach((t) => this.stream.removeTrack(t));
    this.stream.addTrack(track);
  }

  clearStream() {
    this.stream.getTracks().forEach((t) => this.stream.removeTrack(t));
  }
}

class Slot {
  constructor(public readonly transceiver: RTCRtpTransceiver) { }
}

class StateStore {
  seq: bigint = 0n;
  tracks: Map<string, Track> = new Map();
  assignments: Map<string, VideoAssignment> = new Map();
}

export class Participant extends EventEmitter<ParticipantEvents> {
  private adapter: PlatformAdapter;
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel;
  private resourceUri: string | null = null;
  private lastError: Error | null = null;
  private _participantId: string | null = null;

  private localStream: LocalMediaStream;

  private videoSlots: Slot[] = [];
  private audioSlots: Slot[] = [];
  private remoteVideoTracks: Map<string, RemoteVideoTrack> = new Map();
  private mediaState = new StateStore();
  private connState: ConnectionState = "new";
  private lastSentRequests: VideoRequest[] = [];

  private debounceTimer: any | null = null;
  private isReconnecting = false;
  private retryCount = 0;
  private reconnectTimer: any = null;

  constructor(adapter: PlatformAdapter, config: ParticipantConfig) {
    super();
    this.adapter = adapter;

    this.pc = new this.adapter.RTCPeerConnection();
    this.pc.onconnectionstatechange = () => this.handleConnectionState();
    this.dc = this.setupSignaling(this.pc);

    // Receive-only transceivers for remote participants
    for (let i = 0; i < config.videoSlots; i++) {
      this.pc.addTransceiver("video", { direction: "recvonly" });
    }
    for (let i = 0; i < config.audioSlots; i++) {
      this.pc.addTransceiver("audio", { direction: "recvonly" });
    }

    const video = new LocalTrack(this.pc.addTransceiver("video", {
      direction: "sendonly",
      sendEncodings: LocalTrack.PRESET_CAMERA,
    }));
    const audio = new LocalTrack(this.pc.addTransceiver("audio", {
      direction: "sendonly",
    }));
    this.localStream = new LocalMediaStream(video, audio);
  }

  get state(): ConnectionState {
    return this.connState;
  }

  get error(): Error | null {
    return this.lastError;
  }

  get participantId(): string | null {
    return this._participantId;
  }

  /**
   * Connect to a room.
   * Can only be called once.
   */
  async connect(endpoint: string, room: string) {
    if (this.pc.connectionState !== "new") {
      throw new Error("Participant connection has been initated");
    }

    try {
      // try {
      //   const preferredCodecs = this.getPreferredVideoCodecs();
      //   if (preferredCodecs.length > 0) {
      //     this.pc.getTransceivers().forEach((t) => {
      //       if (t.receiver.track.kind === "video") {
      //         t.setCodecPreferences(preferredCodecs);
      //       }
      //     });
      //   }
      // } catch (err) {
      //   console.warn("Failed to set codec preferences", err);
      // }
      //
      const offer = await this.pc.createOffer();
      // const strippedSdp = stripUnusedExtensions(offer.sdp);
      const strippedSdp = offer.sdp;
      await this.pc.setLocalDescription({ type: "offer", sdp: strippedSdp });

      const res = await this.adapter.fetch(
        `${endpoint}/api/v1/rooms/${room}/participants?manual_sub=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: strippedSdp,
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to connect: ${res.status} ${res.statusText}`);
      }

      this.resourceUri = res.headers.get("Location");
      if (!this.resourceUri) {
        throw new Error("Missing Location header");
      }

      const answerSdp = await res.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // Setup physical slots and emit audio tracks
      this.pc.getTransceivers().forEach((t) => {
        if (t.direction === "recvonly") {
          if (t.receiver.track.kind === "video") {
            this.videoSlots.push(new Slot(t));
          } else if (t.receiver.track.kind === "audio") {
            this.audioSlots.push(new Slot(t));
            const stream = new this.adapter.MediaStream([t.receiver.track]);
            const remoteTrack = new RemoteAudioTrack(stream);
            this.emit(ParticipantEvent.AudioTrackAdded, { track: remoteTrack });
          }
        }
      });
    } catch (e) {
      this.lastError = e instanceof Error ? e : new Error(String(e));
      this.emit(ParticipantEvent.Error, this.lastError);
      this.close();
      throw this.lastError;
    }
  }

  private setupSignaling(pc: RTCPeerConnection): RTCDataChannel {
    const dc = pc.createDataChannel(SIGNALING_LABEL, {
      ordered: true,
      maxPacketLifeTime: undefined,
      maxRetransmits: undefined,
      negotiated: true,
      id: 0,
    });
    dc.binaryType = "arraybuffer";
    dc.onmessage = (ev) => this.handleSignal(ev.data);
    return dc;
  }

  /**
   * Can be called before or after connect().
   * Pass null to stop publishing.
   */
  publish(stream: MediaStream | null) {
    this.localStream.stream = stream;
  }

  /**
   * Close the connection and cleanup resources.
   */
  close() {
    if (this.reconnectTimer) this.adapter.clearTimeout(this.reconnectTimer);
    if (this.debounceTimer) this.adapter.clearTimeout(this.debounceTimer);

    if (this.resourceUri) {
      this.adapter
        .fetch(this.resourceUri, { method: "DELETE" })
        .catch(() => { });
    }

    this.stopAllTracks();
    this.pc.close();
    this.connState = "closed";
    this.emit(ParticipantEvent.State, "closed");
  }

  private getPreferredVideoCodecs(): RTCRtpCodecCapability[] {
    if (!this.adapter.getCapabilities) {
      return [];
    }

    const caps = this.adapter.getCapabilities("video");
    if (!caps || !caps.codecs) return [];

    return caps.codecs.filter((c) => {
      const mime = c.mimeType.toLowerCase();
      const fmtp = (c.sdpFmtpLine || "").toLowerCase();

      if (mime !== "video/h264") return false;
      if (!fmtp.includes("packetization-mode=1")) return false;
      if (!fmtp.includes("profile-level-id=42001f")) return false;

      return true;
    });
  }

  private stopAllTracks() {
    this.localStream.stop();
  }

  private getOrCreateRemoteTrack(track: Track): RemoteVideoTrack {
    let remoteTrack = this.remoteVideoTracks.get(track.id);
    if (!remoteTrack) {
      const stream = new this.adapter.MediaStream();
      remoteTrack = new RemoteVideoTrack(track, stream);
      remoteTrack.onLayoutChange = () => this.scheduleReconcile();
      this.remoteVideoTracks.set(remoteTrack.id, remoteTrack);
    }
    return remoteTrack;
  }

  private handleSignal(data: ArrayBuffer) {
    try {
      const msg = fromBinary(ServerMessageSchema, new Uint8Array(data));
      if (msg.payload.case === "update") {
        this.applyUpdate(msg.payload.value);
      } else if (msg.payload.case === "error") {
        console.error("[Participant] SFU Error:", msg.payload.value);
      }
    } catch (e) {
      console.warn("[Participant] Proto decode failed", e);
    }
  }

  private applyUpdate(u: StateUpdate) {
    const seq = u.seq;

    // Gap / Reorder detection
    if (!u.isSnapshot) {
      if (seq > this.mediaState.seq + 1n) return this.sendSyncRequest();
      if (seq <= this.mediaState.seq) return;
    }

    // 1. Snapshot: Identify implicit removals locally
    if (u.isSnapshot) {
      console.log("received a snapshot");
      const incomingIds = new Set(u.tracksUpsert.map((t) => t.id));
      for (const id of this.mediaState.tracks.keys()) {
        if (!incomingIds.has(id)) {
          this.handleTrackRemoval(id);
        }
      }
      this.mediaState.assignments.clear();
    }

    // 2. Delta: Explicit removals
    u.tracksRemove.forEach((id) => this.handleTrackRemoval(id));

    // 3. Upserts
    u.tracksUpsert.forEach((t) => {
      if (!this.mediaState.tracks.has(t.id) && !this.remoteVideoTracks.has(t.id)) {
        const track = this.getOrCreateRemoteTrack(t);
        this.emit(ParticipantEvent.VideoTrackAdded, { track });
      }
      this.mediaState.tracks.set(t.id, t);
    });

    // 4. Assignments
    u.assignmentsRemove.forEach((mid) => this.mediaState.assignments.delete(mid));
    u.assignmentsUpsert.forEach((a) => this.mediaState.assignments.set(a.mid, a));

    this.mediaState.seq = seq;
    this.scheduleReconcile();
    this.routePhysicalToVirtual();
  }

  private handleTrackRemoval(id: string) {
    this.mediaState.tracks.delete(id);
    const track = this.remoteVideoTracks.get(id);
    if (track) {
      track.clearStream();
      this.remoteVideoTracks.delete(id);
      this.emit(ParticipantEvent.VideoTrackRemoved, { trackId: id });
    }
  }

  private routePhysicalToVirtual() {
    // Map active assignments to tracks
    const activeStreams = new Map<string, MediaStreamTrack>();

    for (const pSlot of this.videoSlots) {
      const mid = pSlot.transceiver.mid;
      if (!mid) continue;

      const assignment = this.mediaState.assignments.get(mid);
      if (assignment && !assignment.paused) {
        if (this.mediaState.tracks.has(assignment.trackId)) {
          activeStreams.set(assignment.trackId, pSlot.transceiver.receiver.track);
        }
      }
    }

    // Apply to virtual slots (Set stream if active, clear if paused/unassigned)
    for (const remoteTrack of this.remoteVideoTracks.values()) {
      const track = activeStreams.get(remoteTrack.id);
      if (track) {
        remoteTrack.setStream(track);
      } else {
        remoteTrack.clearStream();
      }
    }
  }

  private scheduleReconcile() {
    if (this.debounceTimer) this.adapter.clearTimeout(this.debounceTimer);
    this.debounceTimer = this.adapter.setTimeout(
      () => this.reconcile(),
      SYNC_DEBOUNCE_MS
    );
  }

  private reconcile() {
    if (this.dc.readyState !== "open") return;

    // 1. Identify desired tracks (implicitly filters out height 0)
    const desiredTracks = Array.from(this.remoteVideoTracks.values())
      .filter((v) => v.height > 0)
      .sort((a, b) => b.height - a.height);

    const nextAssignments = new Map<string, { trackId: string; height: number }>();
    const usedMids = new Set<string>();

    // 2. Sticky Assignments
    for (const pSlot of this.videoSlots) {
      const mid = pSlot.transceiver.mid;
      if (!mid) continue;

      const currentAssignment = this.mediaState.assignments.get(mid);
      if (currentAssignment) {
        const vSlot = this.remoteVideoTracks.get(currentAssignment.trackId);
        // vSlot.height > 0 is checked by presence in desiredTracks
        if (vSlot && desiredTracks.includes(vSlot)) {
          nextAssignments.set(mid, { trackId: vSlot.id, height: vSlot.height });
          usedMids.add(mid);
          // Remove from queue so it doesn't get assigned again
          desiredTracks.splice(desiredTracks.indexOf(vSlot), 1);
        }
      }
    }

    // 3. New Assignments
    for (const vSlot of desiredTracks) {
      const freeSlot = this.videoSlots.find(
        (p) => p.transceiver.mid && !usedMids.has(p.transceiver.mid)
      );
      if (freeSlot) {
        const mid = freeSlot.transceiver.mid!;
        nextAssignments.set(mid, { trackId: vSlot.id, height: vSlot.height });
        usedMids.add(mid);
      }
    }

    // 4. Build Requests (Pruning 0 height/unassigned)
    const requests: VideoRequest[] = [];
    for (const pSlot of this.videoSlots) {
      const mid = pSlot.transceiver.mid;
      if (!mid) continue;

      const assignment = nextAssignments.get(mid);

      // Only include if there is an active assignment. 
      // Unassigned MIDs (or height 0) are omitted (pruned).
      if (assignment) {
        requests.push(
          create(VideoRequestSchema, {
            mid,
            trackId: assignment.trackId,
            height: assignment.height,
          })
        );
      }
    }

    // 5. Idempotent, no sync when nothing changed.
    if (areRequestsEqual(this.lastSentRequests, requests)) return;

    // 6. Update Cache and Send
    // We send even if requests is empty, to ensure we clear the state on the server.
    this.lastSentRequests = requests;

    console.table(requests);
    const intent = create(ClientIntentSchema, { requests });
    const msg = create(ClientMessageSchema, {
      payload: { case: "intent", value: intent },
    });
    this.dc.send(toBinary(ClientMessageSchema, msg));
  }

  private sendSyncRequest() {
    if (this.dc.readyState !== "open") {
      console.warn("signaling data channel is not opened, dropping");
      return;
    };
    const msg = create(ClientMessageSchema, {
      payload: { case: "requestSync", value: true },
    });
    this.dc.send(toBinary(ClientMessageSchema, msg));
    console.info("sent sync request");
  }

  private handleConnectionState() {
    const state = this.pc.connectionState;
    this.connState = state;
    this.emit(ParticipantEvent.State, state);

    if (state === "disconnected" || state === "failed") {
      this.scheduleReconnect();
    } else if (state === "connected") {
      this.isReconnecting = false;
      this.retryCount = 0;
      if (this.reconnectTimer) {
        this.adapter.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    }
  }

  private scheduleReconnect() {
    if (this.isReconnecting || this.connState === "closed") return;

    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
    this.retryCount++;

    if (this.reconnectTimer) this.adapter.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = this.adapter.setTimeout(() => this.reconnect(), delay);
  }

  private async reconnect() {
    if (this.isReconnecting || !this.resourceUri) return;
    this.isReconnecting = true;

    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);

      const res = await this.adapter.fetch(this.resourceUri, {
        method: "PATCH",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Session expired");
        throw new Error(`Reconnect failed: ${res.status}`);
      }

      const answer = await res.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (e) {
      this.isReconnecting = false;
      console.error("[Participant] Reconnect attempt failed:", e);

      if (this.retryCount > 5) {
        this.lastError = e instanceof Error ? e : new Error("Reconnection exhausted");
        this.emit(ParticipantEvent.Error, this.lastError);
        this.close();
      } else {
        this.scheduleReconnect();
      }
    }
  }
}

class LocalMediaStream {
  _stream: MediaStream | null;

  constructor(public readonly video: LocalTrack, public readonly audio: LocalTrack) {
    this._stream = null;
  }

  set stream(s: MediaStream | null) {
    this.stop();
    this.video.track = s?.getVideoTracks()[0] || null;
    this.audio.track = s?.getAudioTracks()[0] || null;
  }

  stop() {
    this.video.stop();
    this.audio.stop();
    this._stream?.stop();
  }
}

class LocalTrack {
  public static PRESET_CAMERA: RTCRtpEncodingParameters[] = [
    {
      rid: "q",
      scaleResolutionDownBy: 4,
      maxBitrate: 150_000,
      active: false
    },
    {
      rid: "h",
      scaleResolutionDownBy: 2,
      maxBitrate: 400_000,
      active: false
    },
    {
      rid: "f",
      scaleResolutionDownBy: 1,
      maxBitrate: 1_250_000,
      active: false
    },
  ];

  // TODO: 
  public static PRESET_SCREEN: RTCRtpEncodingParameters[] = [
    {
      rid: "q",
      scaleResolutionDownBy: 4,
      maxBitrate: 250_000,
      active: false,
    },

    {
      rid: "h",
      scaleResolutionDownBy: 2,
      maxBitrate: 1_000_000,
      active: false,
    },

    {
      rid: "f",
      scaleResolutionDownBy: 1,
      maxBitrate: 3_000_000,
      active: false,
    },
  ];

  private _track: MediaStreamTrack | null;

  constructor(public readonly transceiver: RTCRtpTransceiver) {
    this._track = null;
  }

  stop() {
    this._track?.stop();
  }

  set track(track: MediaStreamTrack | null) {
    this.stop();
    this._track = track;

    this.transceiver.sender.replaceTrack(track).catch((err) => {
      console.error(
        `[Participant] Failed to replace ${track?.kind} track`,
        err
      );
    });

    const params = this.transceiver.sender.getParameters();
    const shouldBeActive = !!track;

    let hasChanges = false;
    for (const config of params.encodings) {
      if (config.active !== shouldBeActive) {
        config.active = shouldBeActive;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.transceiver.sender.setParameters(params).catch((err) => {
        console.error(`[Participant] Failed to set encoding parameters`, err);
      });
    }
  }

  get track(): MediaStreamTrack | null {
    return this._track;
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

function stripUnusedExtensions(sdp: string): string {
  const allowedExtensions = [
    "urn:ietf:params:rtp-hdrext:sdes:mid",
    "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
    "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
    "urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
    "urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id"
  ];

  return sdp
    .split("\r\n")
    .filter((line) => {
      if (line.startsWith("a=extmap:")) {
        return allowedExtensions.some((ext) => line.includes(ext));
      }
      return true;
    })
    .join("\r\n");
}
