import { ClientMessage, ServerMessage } from "./sfu.ts";

const MAX_DOWNSTREAMS = 9;

type MID = string;

export interface ClientCoreConfig {
  sfuUrl: string;
  maxDownstreams: number;
  onStateChanged?: (state: RTCPeerConnectionState) => void;
}

export class ClientCore {
  #sfuUrl: string;
  #pc: RTCPeerConnection;
  #rpc: RTCDataChannel;
  #videoSender: RTCRtpTransceiver;
  #audioSender: RTCRtpTransceiver;
  #closed: boolean;

  #videoSlots: Record<MID, RTCRtpTransceiver>;
  #audioSlots: Record<MID, RTCRtpTransceiver>;

  constructor(cfg: ClientCoreConfig) {
    this.#sfuUrl = cfg.sfuUrl;
    const maxDownstreams = Math.max(
      Math.min(cfg.maxDownstreams, MAX_DOWNSTREAMS),
      0,
    );
    const onStateChanged = cfg.onStateChanged || (() => {});
    this.#closed = false;
    this.#videoSlots = {};
    this.#audioSlots = {};

    this.#pc = new RTCPeerConnection();
    this.#pc.onconnectionstatechange = () => {
      const connectionState = this.#pc.connectionState;
      console.debug(`PeerConnection state changed: ${connectionState}`);
      if (connectionState === "connected") {
        onStateChanged(connectionState);
      } else if (
        connectionState === "failed" || connectionState === "closed" ||
        connectionState === "disconnected"
      ) {
        this.#close(
          `PeerConnection state became: ${connectionState}`,
        );
      }
    };

    this.#pc.ontrack = (event: RTCTrackEvent) => {
      const mid = event.transceiver?.mid;
      const track = event.track;
      if (!mid || !track) {
        console.warn("Received track event without MID or track object.");
        return;
      }

      // TODO: implement this
    };

    // SFU RPC DataChannel
    this.#rpc = this.#pc.createDataChannel("pulsebeam::rpc");
    this.#rpc.binaryType = "arraybuffer";
    this.#rpc.onmessage = (event: MessageEvent) => {
      try {
        const serverMessage = ServerMessage.fromBinary(
          new Uint8Array(event.data as ArrayBuffer),
        );
        const payload = serverMessage.payload;
        const payloadKind = payload.oneofKind;
        if (!payloadKind) {
          console.warn("Received SFU message with undefined payload kind.");
          return;
        }

        // TODO: implement this
      } catch (e: any) {
        this.#close(`Error processing SFU RPC message: ${e}`);
      }
    };
    this.#rpc.onclose = () => {
      this.#close("Internal RPC closed prematurely");
    };
    this.#rpc.onerror = (e) => {
      this.#close(`Internal RPC closed prematurely with an error: ${e}`);
    };

    // Transceivers
    this.#videoSender = this.#pc.addTransceiver("video", {
      direction: "sendonly",
    });
    this.#audioSender = this.#pc.addTransceiver("audio", {
      direction: "sendonly",
    });
    for (let i = 0; i < maxDownstreams; i++) {
      const videoTransceiver = this.#pc.addTransceiver("video", {
        direction: "recvonly",
      });
      if (!videoTransceiver.mid) {
        this.#close("missing mid from video recvonly");
        return;
      }

      this.#videoSlots[videoTransceiver.mid] = videoTransceiver;
      const audioTransceiver = this.#pc.addTransceiver("audio", {
        direction: "recvonly",
      });

      if (!audioTransceiver.mid) {
        this.#close("missing mid from audio recvonly");
        return;
      }
      this.#audioSlots[audioTransceiver.mid] = audioTransceiver;
    }
  }

  #close(error?: string) {
    if (this.#closed) return;

    if (error) {
      console.error("exited with an error:", error);
    }

    this.#closed = true;
  }

  async connect(room: string, participant: string) {
    if (this.#closed) {
      const errorMessage =
        "This client instance has been terminated and cannot be reused.";
      console.error(errorMessage);
      throw new Error(errorMessage); // More direct feedback to developer
    }

    try {
      const offer = await this.#pc.createOffer();
      await this.#pc.setLocalDescription(offer);
      const response = await fetch(
        `${this.#sfuUrl}?room=${room}&participant=${participant}`,
        {
          method: "POST",
          body: offer.sdp!,
          headers: { "Content-Type": "application/sdp" },
        },
      );
      if (!response.ok) {
        throw new Error(
          `Signaling request failed: ${response.status} ${await response
            .text()}`,
        );
      }
      await this.#pc.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      });
      // Status transitions to "connected" will be handled by onconnectionstatechange and data channel onopen events.
    } catch (error: any) {
      this.#close(
        error.message || "Signaling process failed unexpectedly.",
      );
    }
  }

  disconnect() {
    this.#pc.close();
  }

  publish(stream: MediaStream) {
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 1) {
      throw new Error(
        `Unexpected MediaStream composition: Expected at most one video track, but found ${videoTracks.length}. This component or function is designed to handle a single video source and/or a single audio source.`,
      );
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 1) {
      throw new Error(
        `Unexpected MediaStream composition: Expected at most one audio track, but found ${audioTracks.length}. This component or function is designed to handle a single audio source and/or a single audio source.`,
      );
    }

    const newVideoTrack = videoTracks.at(0) || null;
    this.#videoSender.sender.replaceTrack(newVideoTrack);

    const newAudioTrack = audioTracks.at(0) || null;
    this.#audioSender.sender.replaceTrack(newAudioTrack);
  }
}
