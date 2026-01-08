export interface SessionConfig {
  readonly videoSlots: number,
  readonly audioSlots: number,
}

export type SessionEvent =
  | { type: "new" }
  | { type: "connecting" }
  | { type: "connected" }
  | { type: "closed"; error: Error | null };

export class Session {
  public onEvent: ((event: SessionEvent) => void) = (_) => { };

  private pc: RTCPeerConnection;
  private deleteUri: string | null;
  private lastEventType: SessionEvent["type"] = "new";
  private lastError: Error | null = null;
  private videoTrans: RTCRtpTransceiver;
  private audioTrans: RTCRtpTransceiver;

  private videoSlots: RTCRtpTransceiver[];
  private audioSlots: RTCRtpTransceiver[];


  private virtualVideoSlots: VirtualSlot[];
  private virtualAudioSlots: VirtualSlot[];

  constructor(config: SessionConfig) {
    const pc = new RTCPeerConnection();
    // Add recvonly transceivers
    for (let i = 0; i < config.videoSlots; i++) {
      pc.addTransceiver("video", { direction: "recvonly" });
    }
    for (let i = 0; i < config.audioSlots; i++) {
      pc.addTransceiver("audio", { direction: "recvonly" });
    }

    // Add sendonly transceivers
    const videoTrans = pc.addTransceiver("video", {
      direction: "sendonly",
      sendEncodings: [
        { rid: "q", scaleResolutionDownBy: 4, maxBitrate: 150_000 },
        { rid: "h", scaleResolutionDownBy: 2, maxBitrate: 400_000 },
        { rid: "f", scaleResolutionDownBy: 1, maxBitrate: 1_250_000 },
      ],
    });
    const audioTrans = pc.addTransceiver("audio", {
      direction: "sendonly",
    });

    this.videoSlots = [];
    this.audioSlots = [];
    pc.ontrack = (e: RTCTrackEvent) => {
      switch (e.track.kind) {
        case "video":
          this.videoSlots.push(e.transceiver);
          break;
        case "audio":
          this.audioSlots.push(e.transceiver);
          break;
      }
    };
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
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
    };

    this.pc = pc;
    this.deleteUri = null;
    this.videoTrans = videoTrans;
    this.audioTrans = audioTrans;
    this.virtualVideoSlots = [];
    this.virtualAudioSlots = [];
  }

  createVideoSlot(): VirtualSlot {
    const vSlot = new VirtualSlot();
    vSlot.onLayoutChange = (height) => {
      this.handleVirtualSlotUpdate(vSlot, height);
    };

    this.virtualVideoSlots.push(vSlot);
    return vSlot;
  }

  private handleVirtualSlotUpdate(vSlot: VirtualSlot, height: number) {
  }

  publish(stream: MediaStream) {
    const videoTrack = stream.getVideoTracks().at(0);
    if (videoTrack) {
      this.videoTrans.sender.replaceTrack(videoTrack);
    }

    const audioTrack = stream.getAudioTracks().at(0);
    if (audioTrack) {
      this.audioTrans.sender.replaceTrack(audioTrack);
    }
  }

  connect(endpoint: string, room: string) {
    if (this.lastEventType === "closed") {
      throw new Error("Session is closed. You must create a new instance.");
    }

    if (this.lastEventType !== "new") {
      console.warn("Session is already active.");
      return;
    }

    this.connectInternal(endpoint, room);
  }

  close() {
    if (this.deleteUri) {
      fetch(this.deleteUri, { method: 'DELETE' }).catch(() => { });
    }

    this.pc.close();
  }

  private async connectInternal(endpoint: string, room: string) {
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const uri = `${endpoint}/api/v1/rooms/${room}`;
      const response = await fetch(uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      this.deleteUri = response.headers.get('Location');
      await this.pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    } catch (e: any) {
      // Normalize the error and dispatch the polymorphic event
      const error = e instanceof Error ? e : new Error(String(e));

      this.lastError = error;
      this.close();
    }
  }

  private dispatch(event: SessionEvent) {
    // Deduplication: Don't fire "connecting" twice
    if (this.lastEventType === event.type) {
      return;
    }

    this.lastEventType = event.type;

    if (this.onEvent) {
      this.onEvent(event);
    }
  }
}

export class VirtualSlot {
  public readonly stream: MediaStream;
  public onLayoutChange?: (height: number) => void;

  constructor() {
    this.stream = new MediaStream([]);
  }

  setHeight(height: number) {
    if (this.onLayoutChange) {
      this.onLayoutChange(height);
    }
  }
}
