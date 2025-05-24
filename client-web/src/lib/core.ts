import { ClientMessage, MediaConfig, ServerMessage } from "./sfu.ts";

const MAX_DOWNSTREAMS = 16;
const LAST_N_AUDIO = 3;

// Internal Ids
type ParticipantId = string;

interface VideoSlot {
  trans: RTCRtpTransceiver;
  participantId?: ParticipantId;
}

interface ParticipantMeta {
  externalParticipantId: string;
  media?: MediaConfig;
}

export interface ClientCoreConfig {
  sfuUrl: string;
  maxDownstreams: number;
}

export class ClientCore {
  #sfuUrl: string;
  #pc: RTCPeerConnection;
  #rpc: RTCDataChannel;
  #videoSender: RTCRtpTransceiver;
  #audioSender: RTCRtpTransceiver;
  #closed: boolean;

  #videoSlots: VideoSlot[];
  #audioSlots: RTCRtpTransceiver[];

  #participants: Record<ParticipantId, ParticipantMeta>;

  onStateChanged = (state: RTCPeerConnectionState) => {};
  onTrack = (track: RTCPeerConnection) => {};

  constructor(cfg: ClientCoreConfig) {
    this.#sfuUrl = cfg.sfuUrl;
    const maxDownstreams = Math.max(
      Math.min(cfg.maxDownstreams, MAX_DOWNSTREAMS),
      0,
    );
    this.#closed = false;
    this.#videoSlots = [];
    this.#audioSlots = [];
    this.#participants = {};

    this.#pc = new RTCPeerConnection();
    this.#pc.onconnectionstatechange = () => {
      const connectionState = this.#pc.connectionState;
      console.debug(`PeerConnection state changed: ${connectionState}`);
      if (connectionState === "connected") {
        this.onStateChanged(connectionState);
      } else if (
        connectionState === "failed" || connectionState === "closed" ||
        connectionState === "disconnected"
      ) {
        this.#close(
          `PeerConnection state became: ${connectionState}`,
        );
      }
    };

    // SFU RPC DataChannel
    this.#rpc = this.#pc.createDataChannel("pulsebeam::rpc");
    this.#rpc.binaryType = "arraybuffer";
    this.#rpc.onmessage = (event: MessageEvent) => {
      try {
        const serverMessage = ServerMessage.fromBinary(
          new Uint8Array(event.data as ArrayBuffer),
        );
        const msg = serverMessage.msg;
        const msgKind = msg.oneofKind;
        if (!msgKind) {
          console.warn("Received SFU message with undefined payload kind.");
          return;
        }

        switch (msgKind) {
          case "roomSnapshot":
            for (const participant of msg.roomSnapshot.participants) {
              this.#participants[participant.participantId] = {
                externalParticipantId: participant.externalParticipantId,
                media: participant.media,
              };
            }
            break;
          case "streamUpdate":
            if (msg.streamUpdate.participantStream) {
              const stream = msg.streamUpdate.participantStream;
              if (stream.participantId in this.#participants) {
                const participant = this.#participants[stream.participantId];
                participant.media = stream.media;
                participant.externalParticipantId =
                  stream.externalParticipantId;
              } else {
                this.#participants[stream.participantId] = {
                  externalParticipantId: stream.externalParticipantId,
                  media: stream.media,
                };
              }
            }
            break;
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

    for (let i = 0; i < LAST_N_AUDIO; i++) {
      this.#pc.addTransceiver("audio", {
        direction: "recvonly",
      });
    }

    for (let i = 0; i < maxDownstreams; i++) {
      this.#pc.addTransceiver("video", {
        direction: "recvonly",
      });
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

    if (this.#pc.connectionState != "new") {
      const errorMessage =
        "This client instance has been initiated and cannot be reused.";
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

      // https://blog.mozilla.org/webrtc/rtcrtptransceiver-explored/
      // transceivers order is stable, and mid is only defined after setLocalDescription
      const transceivers = this.#pc.getTransceivers();
      for (const trans of transceivers) {
        if (trans.direction === "sendonly") {
          continue;
        }

        if (trans.receiver.track.kind === "audio") {
          this.#audioSlots.push(trans);
        } else if (trans.receiver.track.kind === "video") {
          this.#videoSlots.push({
            trans,
          });
        }
      }

      // Status transitions to "connected" will be handled by onconnectionstatechange
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

  unpublish() {
    this.#videoSender.sender.replaceTrack(null);
    this.#audioSender.sender.replaceTrack(null);
  }
}
