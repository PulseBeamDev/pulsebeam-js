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

const SIGNALING_LABEL = "__internal/v1/signaling";
const DEBOUNCE_MS = 50;

export interface ParticipantConfig {
  readonly videoSlots: number;
  readonly audioSlots: number;
}

export type ParticipantEvent =
  | { type: "new" }
  | { type: "connecting" }
  | { type: "connected" }
  | { type: "closed"; error: Error | null }
  | { type: "slot_added"; slot: Slot }
  | { type: "slot_removed"; slotId: string }

export class Slot {
  public height: number = 0;
  public onLayoutChange?: () => void;

  constructor(
    public readonly track: Track,
    public readonly stream: MediaStream
  ) { }

  get id() {
    return this.track.id;
  }

  setHeight(h: number) {
    const safeHeight = Math.floor(h);
    if (this.height === safeHeight) return;
    this.height = safeHeight;
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

class PhysicalSlot {
  constructor(public readonly transceiver: RTCRtpTransceiver) { }
}

class StateStore {
  seq: bigint = 0n;
  tracks: Map<string, Track> = new Map();
  assignments: Map<string, VideoAssignment> = new Map();
}

export class Participant {
  public onEvent: (event: ParticipantEvent) => void = (_) => { };

  private adapter: PlatformAdapter;
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel;
  private deleteUri: string | null = null;
  private lastEventType: ParticipantEvent["type"] = "new";
  private lastError: Error | null = null;

  private primary: LocalMediaStream;
  private secondary: LocalMediaStream;

  private physicalSlots: PhysicalSlot[] = [];
  private virtualSlots: Map<string, Slot> = new Map();
  private state = new StateStore();

  private debounceTimer: any | null = null;

  constructor(adapter: PlatformAdapter, config: ParticipantConfig) {
    this.adapter = adapter;

    this.pc = new this.adapter.RTCPeerConnection();
    this.pc.onconnectionstatechange = () => this.handleConnectionState();

    this.dc = this.pc.createDataChannel(SIGNALING_LABEL, { ordered: true });
    this.dc.binaryType = "arraybuffer";
    this.dc.onmessage = (ev) => this.handleSignal(ev.data);

    // Receive-only transceivers for remote participants
    for (let i = 0; i < config.videoSlots; i++) {
      this.pc.addTransceiver("video", { direction: "recvonly" });
    }
    for (let i = 0; i < config.audioSlots; i++) {
      this.pc.addTransceiver("audio", { direction: "recvonly" });
    }

    const primaryVideo = new LocalTrack(this.pc.addTransceiver("video", {
      direction: "sendonly",
      sendEncodings: LocalTrack.PRESET_CAMERA,
    }));
    const primaryAudio = new LocalTrack(this.pc.addTransceiver("audio", {
      direction: "sendonly",
    }));
    this.primary = new LocalMediaStream(primaryVideo, primaryAudio);

    const secondaryVideo = new LocalTrack(this.pc.addTransceiver("video", {
      direction: "sendonly",
      sendEncodings: LocalTrack.PRESET_SCREEN,
    }));
    const secondaryAudio = new LocalTrack(this.pc.addTransceiver("audio", {
      direction: "sendonly",
    }));
    this.secondary = new LocalMediaStream(secondaryVideo, secondaryAudio);
  }

  /**
   * Connect to a room.
   * Can only be called once.
   */
  async connect(endpoint: string, room: string): Promise<void> {
    if (this.lastEventType !== "new") {
      throw new Error("Participant already connected or closed");
    }

    try {
      const offer = await this.pc.createOffer();
      if (!offer.sdp) throw new Error("Failed to generate offer");
      await this.pc.setLocalDescription(offer);

      const res = await this.adapter.fetch(
        `${endpoint}/api/v1/rooms/${room}/participants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to connect: ${res.status} ${res.statusText}`);
      }

      this.deleteUri = res.headers.get("Location");
      const answerSdp = await res.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // Setup physical slots and emit audio tracks
      this.pc.getTransceivers().forEach((t) => {
        if (t.direction === "recvonly") {
          if (t.receiver.track.kind === "video") {
            this.physicalSlots.push(new PhysicalSlot(t));
          } else if (t.receiver.track.kind === "audio") {
            // TODO: audio
            // this.dispatch({ type: "slot_added", slot: new Slot("audio")})
          }
        }
      });
    } catch (e) {
      this.lastError = e instanceof Error ? e : new Error(String(e));
      this.dispatch({ type: "closed", error: this.lastError });
      this.close();
      throw this.lastError;
    }
  }

  /**
   * Set primary media stream (camera + microphone).
   * Can be called before or after connect().
   * Pass null to stop publishing.
   */
  setPrimary(stream: MediaStream | null) {
    this.primary.stream = stream;
  }

  /**
   * Set secondary media stream (e.g. screen share).
   * Can be called before or after connect().
   * Pass null to stop publishing.
   */
  setSecondary(stream: MediaStream | null) {
    this.secondary.stream = stream;
  }

  /**
   * Close the connection and cleanup resources.
   */
  close() {
    if (this.deleteUri) {
      this.adapter
        .fetch(this.deleteUri, { method: "DELETE" })
        .catch(() => { });
    }

    // Stop all local tracks
    this.stopAllTracks();
    this.pc.close();
  }

  private stopAllTracks() {
    this.primary.stop();
    this.secondary.stop();
  }

  private getOrCreateVirtualSlot(track: Track): Slot {
    let vSlot = this.virtualSlots.get(track.id);
    if (!vSlot) {
      const stream = new this.adapter.MediaStream();
      vSlot = new Slot(track, stream);
      vSlot.onLayoutChange = () => this.scheduleReconcile();
      this.virtualSlots.set(vSlot.id, vSlot);
    }
    return vSlot;
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
    if (!u.isSnapshot) {
      if (seq > this.state.seq + 1n) return this.sendSyncRequest();
      if (seq <= this.state.seq) return;
    }

    if (u.isSnapshot) {
      this.state.tracks.clear();
      this.state.assignments.clear();
      this.virtualSlots.forEach((v) => v.clearStream());
    }

    u.tracksRemove.forEach((id) => {
      this.state.tracks.delete(id);
      this.dispatch({ type: "slot_removed", slotId: id });
      const vSlot = this.virtualSlots.get(id);
      if (vSlot) {
        vSlot.clearStream();
        this.virtualSlots.delete(id);
      }
    });

    u.tracksUpsert.forEach((t) => {
      if (!this.state.tracks.has(t.id)) {
        const vSlot = this.getOrCreateVirtualSlot(t);
        this.dispatch({ type: "slot_added", slot: vSlot });
      }
      this.state.tracks.set(t.id, t);
    });

    u.assignmentsRemove.forEach((mid) => this.state.assignments.delete(mid));
    u.assignmentsUpsert.forEach((a) => this.state.assignments.set(a.mid, a));
    this.state.seq = seq;

    this.routePhysicalToVirtual();
    this.scheduleReconcile();
  }

  private routePhysicalToVirtual() {
    for (const pSlot of this.physicalSlots) {
      const mid = pSlot.transceiver.mid;
      if (!mid) continue;
      const assignment = this.state.assignments.get(mid);
      if (assignment) {
        const vSlot = this.virtualSlots.get(assignment.trackId);
        if (vSlot) vSlot.setStream(pSlot.transceiver.receiver.track);
      }
    }
  }

  private scheduleReconcile() {
    if (this.debounceTimer) this.adapter.clearTimeout(this.debounceTimer);
    this.debounceTimer = this.adapter.setTimeout(
      () => this.reconcile(),
      DEBOUNCE_MS
    );
  }

  private reconcile() {
    if (this.dc.readyState !== "open") return;

    const desiredTracks = Array.from(this.virtualSlots.values())
      .filter((v) => v.height > 0)
      .sort((a, b) => b.height - a.height);

    const requests: VideoRequest[] = [];
    const usedMids = new Set<string>();

    for (const pSlot of this.physicalSlots) {
      const mid = pSlot.transceiver.mid;
      if (!mid) continue;

      const currentAssignment = this.state.assignments.get(mid);
      if (currentAssignment) {
        const vSlot = this.virtualSlots.get(currentAssignment.trackId);
        if (vSlot && vSlot.height > 0) {
          requests.push(
            create(VideoRequestSchema, {
              mid,
              trackId: vSlot.id,
              height: vSlot.height,
            })
          );
          usedMids.add(mid);
          const idx = desiredTracks.indexOf(vSlot);
          if (idx > -1) desiredTracks.splice(idx, 1);
        }
      }
    }

    for (const vSlot of desiredTracks) {
      const freeSlot = this.physicalSlots.find(
        (p) => p.transceiver.mid && !usedMids.has(p.transceiver.mid)
      );
      if (freeSlot) {
        const mid = freeSlot.transceiver.mid!;
        requests.push(
          create(VideoRequestSchema, {
            mid,
            trackId: vSlot.id,
            height: vSlot.height,
          })
        );
        usedMids.add(mid);
      }
    }

    if (requests.length > 0) {
      const intent = create(ClientIntentSchema, { requests });
      const msg = create(ClientMessageSchema, {
        payload: { case: "intent", value: intent },
      });
      this.dc.send(toBinary(ClientMessageSchema, msg));
    }
  }

  private sendSyncRequest() {
    if (this.dc.readyState !== "open") return;
    const msg = create(ClientMessageSchema, {
      payload: { case: "requestSync", value: true },
    });
    this.dc.send(toBinary(ClientMessageSchema, msg));
  }

  private handleConnectionState() {
    switch (this.pc.connectionState) {
      case "new":
        this.dispatch({ type: "new" });
        break;
      case "connecting":
        this.dispatch({ type: "connecting" });
        break;
      case "connected":
        this.dispatch({ type: "connected" });
        break;
      case "failed":
        this.pc.close();
        break;
      case "closed":
        this.dispatch({ type: "closed", error: this.lastError });
        break;
    }
  }

  private dispatch(event: ParticipantEvent) {
    this.lastEventType = event.type;
    this.onEvent(event);
  }
}

class LocalMediaStream {
  _stream: MediaStream | null;

  constructor(public readonly video: LocalTrack, public readonly audio: LocalTrack) {
    this._stream = null;
  }

  set stream(s: MediaStream | null) {
    this.video.track = s?.getVideoTracks()[0] || null;
    this.audio.track = s?.getAudioTracks()[0] || null;
  }

  stop() {
    this.video.stop();
    this.audio.stop();
  }
}

class LocalTrack {
  public static PRESET_CAMERA: RTCRtpEncodingParameters[] = [
    { rid: "q", scaleResolutionDownBy: 4, maxBitrate: 150_000 },
    { rid: "h", scaleResolutionDownBy: 2, maxBitrate: 400_000 },
    { rid: "f", scaleResolutionDownBy: 1, maxBitrate: 1_250_000 },
  ];

  // TODO: 
  public static PRESET_SCREEN: RTCRtpEncodingParameters[] = [
    {
      rid: "q",
      scaleResolutionDownBy: 4,
      maxBitrate: 250_000,
    },

    {
      rid: "h",
      scaleResolutionDownBy: 2,
      maxBitrate: 1_000_000,
    },

    {
      rid: "f",
      scaleResolutionDownBy: 1,
      maxBitrate: 3_000_000,
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
  }

  get track(): MediaStreamTrack | null {
    return this._track;
  }
}
