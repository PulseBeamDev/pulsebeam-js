import {
  ClientMessageSchema,
  ServerMessageSchema,
  ClientIntentSchema,
  VideoRequestSchema,
  type VideoAssignment,
  type StateUpdate,
  type VideoRequest,
  type Track
} from "./gen/signaling_pb";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";

const SIGNALING_LABEL = "__internal/v1/signaling";
const DEBOUNCE_MS = 50;

export interface SessionConfig {
  readonly videoSlots: number;
  readonly audioSlots: number;
}

export type SessionEvent =
  | { type: "new" }
  | { type: "connecting" }
  | { type: "connected" }
  | { type: "closed"; error: Error | null }
  | { type: "track_added"; trackId: string; meta: { [key: string]: string } }
  | { type: "track_removed"; trackId: string };

class StateStore {
  seq: bigint = 0n;
  tracks: Map<string, Track> = new Map();
  assignments: Map<string, VideoAssignment> = new Map();
}

export class Session {
  public onEvent: ((event: SessionEvent) => void) = (_) => { };

  private pc: RTCPeerConnection;
  private dc: RTCDataChannel;
  private deleteUri: string | null = null;
  private lastEventType: SessionEvent["type"] = "new";
  private lastError: Error | null = null;

  private videoTrans: RTCRtpTransceiver;
  private audioTrans: RTCRtpTransceiver;

  private physicalSlots: PhysicalSlot[] = [];
  private virtualSlots: Map<string, VirtualSlot> = new Map();

  private state = new StateStore();
  private debounceTimer: number | null = null;

  constructor(config: SessionConfig) {
    this.pc = new RTCPeerConnection();
    this.dc = this.pc.createDataChannel(SIGNALING_LABEL, { ordered: true });
    this.dc.binaryType = "arraybuffer";
    this.dc.onmessage = (ev) => this.handleSignal(ev.data);

    for (let i = 0; i < config.videoSlots; i++) {
      this.pc.addTransceiver("video", { direction: "recvonly" });
    }
    for (let i = 0; i < config.audioSlots; i++) {
      this.pc.addTransceiver("audio", { direction: "recvonly" });
    }

    this.videoTrans = this.pc.addTransceiver("video", {
      direction: "sendonly",
      sendEncodings: [
        { rid: "q", scaleResolutionDownBy: 4, maxBitrate: 150_000 },
        { rid: "h", scaleResolutionDownBy: 2, maxBitrate: 400_000 },
        { rid: "f", scaleResolutionDownBy: 1, maxBitrate: 1_250_000 },
      ],
    });
    this.audioTrans = this.pc.addTransceiver("audio", { direction: "sendonly" });

    this.pc.onconnectionstatechange = () => this.handleConnectionState();

    this.pc.getTransceivers().forEach(t => {
      if (t.direction === "recvonly") {
        if (t.receiver.track.kind === "video") {
          this.physicalSlots.push(new PhysicalSlot(t));
        } else if (t.receiver.track.kind === "audio") {
          t.receiver.track.enabled = true;
        }
      }
    });
  }

  getVirtualSlot(trackId: string): VirtualSlot {
    let vSlot = this.virtualSlots.get(trackId);
    if (!vSlot) {
      vSlot = new VirtualSlot(trackId);
      vSlot.onLayoutChange = () => this.scheduleReconcile();
      this.virtualSlots.set(trackId, vSlot);
    }
    return vSlot;
  }

  publish(stream: MediaStream) {
    const video = stream.getVideoTracks()[0];
    if (video) this.videoTrans.sender.replaceTrack(video);
    const audio = stream.getAudioTracks()[0];
    if (audio) this.audioTrans.sender.replaceTrack(audio);
  }

  connect(endpoint: string, room: string) {
    if (this.lastEventType !== "new") return;
    this.connectInternal(endpoint, room);
  }

  close() {
    if (this.deleteUri) fetch(this.deleteUri, { method: 'DELETE' }).catch(() => { });
    this.pc.close();
  }

  private handleSignal(data: ArrayBuffer) {
    try {
      const msg = fromBinary(ServerMessageSchema, new Uint8Array(data));
      if (msg.payload.case === "update") {
        this.applyUpdate(msg.payload.value);
      } else if (msg.payload.case === "error") {
        console.error("SFU Error:", msg.payload.value);
      }
    } catch (e) {
      console.warn("Proto decode failed", e);
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
      this.virtualSlots.forEach(v => v.clearStream());
    }

    u.tracksRemove.forEach((id) => {
      this.state.tracks.delete(id);
      this.dispatch({ type: "track_removed", trackId: id });

      const vSlot = this.virtualSlots.get(id);
      if (vSlot) {
        vSlot.clearStream();
        this.virtualSlots.delete(id);
      }
    });

    u.tracksUpsert.forEach((t) => {
      if (!this.state.tracks.has(t.id)) {
        this.dispatch({ type: "track_added", trackId: t.id, meta: t.meta });
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
        if (vSlot) {
          vSlot.setStream(pSlot.transceiver.receiver.track);
        }
      }
    }
  }

  private scheduleReconcile() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => this.reconcile(), DEBOUNCE_MS);
  }

  private reconcile() {
    if (this.dc.readyState !== "open") return;

    // Filter slots that have any visibility
    const desiredTracks = Array.from(this.virtualSlots.values())
      .filter(v => v.height > 0)
      .sort((a, b) => b.height - a.height);

    const requests: VideoRequest[] = [];
    const usedMids = new Set<string>();

    // 1. Maintain existing assignments if valuable
    for (const pSlot of this.physicalSlots) {
      const mid = pSlot.transceiver.mid;
      if (!mid) continue;

      const currentAssignment = this.state.assignments.get(mid);
      if (currentAssignment) {
        const vSlot = this.virtualSlots.get(currentAssignment.trackId);
        if (vSlot && vSlot.height > 0) {
          requests.push(create(VideoRequestSchema, {
            mid,
            trackId: vSlot.trackId,
            height: vSlot.height // This is now guaranteed integer
          }));
          usedMids.add(mid);
          const idx = desiredTracks.indexOf(vSlot);
          if (idx > -1) desiredTracks.splice(idx, 1);
        }
      }
    }

    // 2. Assign remaining slots
    for (const vSlot of desiredTracks) {
      const freeSlot = this.physicalSlots.find(p => p.transceiver.mid && !usedMids.has(p.transceiver.mid));

      if (freeSlot) {
        const mid = freeSlot.transceiver.mid!;
        requests.push(create(VideoRequestSchema, {
          mid,
          trackId: vSlot.trackId,
          height: vSlot.height
        }));
        usedMids.add(mid);
      }
    }

    if (requests.length > 0) {
      const intent = create(ClientIntentSchema, { requests });
      const msg = create(ClientMessageSchema, {
        payload: { case: "intent", value: intent }
      });
      this.dc.send(toBinary(ClientMessageSchema, msg));
    }
  }

  private sendSyncRequest() {
    if (this.dc.readyState !== "open") return;
    const msg = create(ClientMessageSchema, {
      payload: { case: "requestSync", value: true }
    });
    this.dc.send(toBinary(ClientMessageSchema, msg));
  }

  private handleConnectionState() {
    switch (this.pc.connectionState) {
      case "new": this.dispatch({ type: "new" }); break;
      case "connecting": this.dispatch({ type: "connecting" }); break;
      case "connected": this.dispatch({ type: "connected" }); break;
      case "failed": this.pc.close(); break;
      case "closed": this.dispatch({ type: "closed", error: this.lastError }); break;
    }
  }

  private dispatch(event: SessionEvent) {
    if (this.lastEventType === event.type && event.type !== "track_added" && event.type !== "track_removed") return;
    if (event.type !== "track_added" && event.type !== "track_removed") this.lastEventType = event.type;
    this.onEvent(event);
  }

  private async connectInternal(endpoint: string, room: string) {
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      const res = await fetch(`${endpoint}/api/v1/rooms/${room}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      this.deleteUri = res.headers.get('Location');
      await this.pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
    } catch (e) {
      this.lastError = e instanceof Error ? e : new Error(String(e));
      this.close();
    }
  }
}

class PhysicalSlot {
  constructor(public readonly transceiver: RTCRtpTransceiver) { }
}

export class VirtualSlot {
  public readonly stream = new MediaStream();
  public height: number = 0;
  public onLayoutChange?: () => void;
  private currentTrackId: string | null = null;

  constructor(public readonly trackId: string) { }

  setHeight(h: number) {
    const safeHeight = Math.floor(h);

    if (this.height === safeHeight) return;
    this.height = safeHeight;
    this.onLayoutChange?.();
  }

  setStream(track: MediaStreamTrack) {
    if (this.currentTrackId === track.id) return;
    this.stream.getTracks().forEach(t => this.stream.removeTrack(t));
    this.stream.addTrack(track);
    this.currentTrackId = track.id;
  }

  clearStream() {
    this.stream.getTracks().forEach(t => this.stream.removeTrack(t));
    this.currentTrackId = null;
  }
}
