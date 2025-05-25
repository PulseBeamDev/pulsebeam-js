import {
  ClientMessage,
  MediaConfig,
  ParticipantStream,
  ParticipantSubscription,
  ServerMessage,
} from "./sfu.ts";
import {
  atom,
  map,
  type PreinitializedMapStore,
  type PreinitializedWritableAtom,
} from "nanostores";

const MAX_DOWNSTREAMS = 16;
const LAST_N_AUDIO = 3;
const DEBOUNCE_DELAY_MS = 500;

// Internal Ids
type ParticipantId = string;

interface VideoSlot {
  trans: RTCRtpTransceiver;
  participantId?: ParticipantId;
}

export interface ParticipantMeta {
  externalParticipantId: string;
  participantId: string;
  media: MediaConfig;
  stream: MediaStream;
  maxHeight: number;
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
  #sequence: number;

  #videoSlots: VideoSlot[];
  #audioSlots: RTCRtpTransceiver[];
  #timeoutId: ReturnType<typeof setTimeout> | null;

  $participants: PreinitializedMapStore<
    Record<ParticipantId, PreinitializedMapStore<ParticipantMeta>>
  >;
  $state: PreinitializedWritableAtom<RTCPeerConnectionState>;

  constructor(cfg: ClientCoreConfig) {
    this.#sfuUrl = cfg.sfuUrl;
    const maxDownstreams = Math.max(
      Math.min(cfg.maxDownstreams, MAX_DOWNSTREAMS),
      0,
    );
    this.#closed = false;
    this.#videoSlots = [];
    this.#audioSlots = [];
    this.#sequence = 0;
    this.#timeoutId = null;
    this.$participants = map({});
    this.$state = atom("new");

    this.#pc = new RTCPeerConnection();
    this.#pc.onconnectionstatechange = () => {
      const connectionState = this.#pc.connectionState;
      console.debug(`PeerConnection state changed: ${connectionState}`);
      this.$state.set(connectionState);
      if (
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
            this.#handleParticipantUpdates(msg.roomSnapshot.participants);
            break;
          case "streamUpdate":
            if (msg.streamUpdate.participantStream) {
              this.#handleParticipantUpdates([
                msg.streamUpdate.participantStream,
              ]);
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

  #sendRpc(msg: ClientMessage["msg"]) {
    this.#rpc.send(ClientMessage.toBinary({
      sequence: this.#sequence,
      msg,
    }));
    this.#sequence += 1;
  }

  #handleParticipantUpdates(streams: ParticipantStream[]) {
    const newParticipants: ParticipantMeta[] = [];

    for (const stream of streams) {
      if (!stream.media) {
        // participant has left
        this.$participants.setKey(stream.participantId, undefined);
        continue;
      }

      if (stream.participantId in this.$participants.get()) {
        const participant = this.$participants.get()[stream.participantId];
        participant.setKey("media", stream.media);
        participant.setKey(
          "externalParticipantId",
          stream.externalParticipantId,
        );
        participant.setKey("participantId", stream.participantId);
      } else {
        const meta: ParticipantMeta = {
          externalParticipantId: stream.externalParticipantId,
          participantId: stream.participantId,
          media: stream.media,
          stream: new MediaStream(),
          maxHeight: 0, // default invisible until the UI tells us to render
        };

        const reactiveMeta = atom(meta);
        reactiveMeta.listen((_) => {
          this.#triggerSubscriptionFeedback();
        });
        this.$participants.setKey(stream.participantId, atom(meta));
        newParticipants.push(meta);
      }
    }

    // TODO: should we bin pack the old participants first?
    for (const slot of this.#videoSlots) {
      if (slot.participantId) {
        if (slot.participantId in this.$participants) {
          continue;
        }

        slot.participantId = undefined;
      }

      const participant = newParticipants.pop();
      if (!participant) {
        continue;
      }

      slot.participantId = participant.participantId;
    }

    this.#triggerSubscriptionFeedback();
  }

  #close(error?: string) {
    if (this.#closed) return;

    if (error) {
      console.error("exited with an error:", error);
    }

    this.#closed = true;
  }

  #triggerSubscriptionFeedback() {
    if (this.#timeoutId) {
      return;
    }

    this.#timeoutId = setTimeout(() => {
      const subscriptions: ParticipantSubscription[] = Object.values(
        this.$participants,
      ).map((p) => ({
        participantId: p.participantId,
        videoSettings: {
          maxHeight: p.maxHeight,
        },
      }));
      this.#sendRpc({
        oneofKind: "videoSubscription",
        videoSubscription: {
          subscriptions,
        },
      });
    }, DEBOUNCE_DELAY_MS);
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
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
    }
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
