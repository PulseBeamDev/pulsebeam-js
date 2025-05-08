import { atom, map, type MapStore, type WritableAtom } from "nanostores";
import {
  ClientMessage,
  ClientSubscribePayload,
  ClientUnsubscribePayload,
  ErrorPayload,
  ServerMessage,
  SubscriptionErrorPayload,
  TrackKind,
  TrackPublishedPayload,
  TrackUnpublishedPayload,
} from "./sfu";

const MAX_DOWNSTREAMS = 9;

export type ClientStatus =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export interface RemoteTrack {
  slotId: string;
  remoteTrackId: string;
  kind: "video" | "audio";
  track: MediaStreamTrack | null;
  error?: string;
}

export interface AvailableTrack {
  remoteTrackId: string;
  kind: "video" | "audio";
  participantId: string;
}

export interface AppDataChannelConfig {
  onMessage: (data: string) => void; // Expects string data
  onOpen?: (event: Event) => void;
  onClose?: (event: Event) => void;
  options?: RTCDataChannelInit; // Still allow options like 'ordered'
}

export class PulsebeamClient {
  readonly #sfuUrl: string;

  #pc: RTCPeerConnection;
  #sfuRpcCh: RTCDataChannel;
  #appDataCh: RTCDataChannel;

  #videoSender: RTCRtpSender;
  #audioSender: RTCRtpSender;

  #videoRecvMids: string[] = [];
  #audioRecvMids: string[] = [];
  #usedMids = new Set<string>();
  #activeSubscriptions = new Map<string, { slotId: string; kind: TrackKind }>(); // remoteTrackId -> subInfo

  #instanceTerminated = false;

  public readonly status: WritableAtom<ClientStatus> = atom("new");
  public readonly localVideo: WritableAtom<MediaStreamTrack | null> = atom(
    null,
  );
  public readonly localAudio: WritableAtom<MediaStreamTrack | null> = atom(
    null,
  );
  public readonly remoteTracks: MapStore<Record<string, RemoteTrack>> = map({});
  public readonly availableTracks: MapStore<Record<string, AvailableTrack>> =
    map({});
  public readonly errorMsg: WritableAtom<string | null> = atom(null);

  constructor(
    sfuUrl: string,
    maxDownstreams: number = 9,
    appDataConfig?: AppDataChannelConfig,
  ) {
    this.#sfuUrl = sfuUrl;
    maxDownstreams = Math.max(
      Math.min(maxDownstreams, MAX_DOWNSTREAMS),
      0,
    );

    this.#pc = new RTCPeerConnection();
    this.#pc.onconnectionstatechange = () => {
      if (this.#instanceTerminated || !this.#pc) return; // Guard
      const connectionState = this.#pc.connectionState;
      console.debug(`PeerConnection state changed: ${connectionState}`);
      if (connectionState === "connected") {
        this.#updateConnectedStatus();
      } else if (
        connectionState === "failed" || connectionState === "closed" ||
        connectionState === "disconnected"
      ) {
        // 'disconnected' is often transient, but for this minimal client, we treat it as terminal.
        this.#terminateInstance(
          "failed",
          `PeerConnection state became: ${connectionState}`,
        );
      }
    };

    this.#pc.ontrack = (event: RTCTrackEvent) => {
      if (this.#instanceTerminated) return;
      const mid = event.transceiver?.mid;
      const track = event.track;
      if (!mid || !track) {
        console.warn("Received track event without MID or track object.");
        return;
      }

      const remoteTrackId = Array.from(this.#activeSubscriptions.entries())
        .find(
          ([_rId, subInfo]) =>
            subInfo.slotId === mid &&
            subInfo.kind ===
            (track.kind === "video" ? TrackKind.VIDEO : TrackKind.AUDIO),
        )?.[0];

      if (remoteTrackId) {
        this.remoteTracks.setKey(remoteTrackId, {
          slotId: mid,
          remoteTrackId: remoteTrackId,
          kind: track.kind as "video" | "audio",
          track: track,
          error: undefined,
        });
        track.onended = () => {
          if (this.#instanceTerminated) return;
          const currentTrackInfo = this.remoteTracks.get()[remoteTrackId];
          if (currentTrackInfo) { // Ensure it hasn't been removed by unsubscribe
            this.remoteTracks.setKey(remoteTrackId, {
              ...currentTrackInfo,
              track: null,
            });
          }
        };
      } else {
        console.warn(
          `Received track on MID ${mid} (kind: ${track.kind}) but no matching subscription found. Stopping track.`,
        );
        track.stop();
      }
    };

    // SFU RPC DataChannel
    this.#sfuRpcCh = this.#pc.createDataChannel("pulsebeam::rpc");
    this.#sfuRpcCh.binaryType = "arraybuffer";
    this.#sfuRpcCh.onopen = () => {
      if (!this.#instanceTerminated) this.#updateConnectedStatus();
    };
    this.#sfuRpcCh.onmessage = (event: MessageEvent) => {
      if (this.#instanceTerminated) return;
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

        switch (payload.oneofKind) {
          case "error":
            this.errorMsg.set(payload.error.message);
            break;
          case "subscriptionError":
            const subError = payload.subscriptionError;
            const targetId = subError.remoteTrackId ||
              Array.from(this.#activeSubscriptions.entries()).find(([, s]) =>
                s.slotId === subError.mid
              )?.[0];
            if (targetId) {
              const currentRemote = this.remoteTracks.get()[targetId];
              if (currentRemote) {
                this.remoteTracks.setKey(targetId, {
                  ...currentRemote,
                  error: subError.message,
                  track: null,
                });
              }
              const subInfo = this.#activeSubscriptions.get(targetId);
              if (subInfo) {
                this.#usedMids.delete(subInfo.slotId);
                this.#activeSubscriptions.delete(targetId);
              }
            }
            this.errorMsg.set(
              `Subscription error for ${targetId || subError.mid || "track"
              }: ${subError.message}`,
            );
            break;
          case "trackPublished":
            const trackPublished = payload.trackPublished;
            this.availableTracks.setKey(trackPublished.remoteTrackId, {
              remoteTrackId: trackPublished.remoteTrackId,
              kind: trackPublished.kind === TrackKind.VIDEO ? "video" : "audio",
              participantId: trackPublished.participantId,
            });
            break;
          case "trackUnpublished":
            const trackUnpublished = payload.trackUnpublished;
            if (this.#activeSubscriptions.has(trackUnpublished.remoteTrackId)) {
              this.unsubscribe(trackUnpublished.remoteTrackId);
            }
            this.availableTracks.setKey(
              trackUnpublished.remoteTrackId,
              undefined,
            );
            break;
        }
      } catch (e: any) {
        console.error("Error processing SFU RPC message:", e);
        this.errorMsg.set("Failed to process server message.");
      }
    };
    const createFatalRpcHandler = (type: string) => () => {
      if (!this.#instanceTerminated) {
        this.#terminateInstance("failed", `SFU RPC DataChannel ${type}`);
      }
    };
    this.#sfuRpcCh.onclose = createFatalRpcHandler("closed");
    this.#sfuRpcCh.onerror = createFatalRpcHandler("error");

    if (!appDataConfig) {
      appDataConfig = {
        onMessage: () => { },
      };
    }

    this.#appDataCh = this.#pc.createDataChannel(
      "app::data",
      appDataConfig.options,
    );
    this.#appDataCh.onopen = appDataConfig.onOpen || null;
    this.#appDataCh.onclose = appDataConfig.onClose || null;

    // Transceivers
    this.#videoSender =
      this.#pc.addTransceiver("video", { direction: "sendonly" }).sender;
    this.#audioSender =
      this.#pc.addTransceiver("audio", { direction: "sendonly" }).sender;
    for (let i = 0; i < maxDownstreams; i++) {
      const videoTransceiver = this.#pc.addTransceiver("video", {
        direction: "recvonly",
      });
      if (videoTransceiver.mid) this.#videoRecvMids.push(videoTransceiver.mid);
      const audioTransceiver = this.#pc.addTransceiver("audio", {
        direction: "recvonly",
      });
      if (audioTransceiver.mid) this.#audioRecvMids.push(audioTransceiver.mid);
    }
  }

  #terminateInstance(
    finalStatus: "disconnected" | "failed",
    message?: string,
  ): void {
    if (this.#instanceTerminated) {
      return;
    }
    this.#instanceTerminated = true;
    console.debug(
      `PulsebeamClient: Terminating instance with status: ${finalStatus}, message: ${message || "N/A"
      }`,
    );

    this.localVideo.get()?.stop();
    this.localAudio.get()?.stop();
    this.localVideo.set(null);
    this.localAudio.set(null);

    Object.values(this.remoteTracks.get()).forEach((remoteTrackInfo) => {
      remoteTrackInfo?.track?.stop();
    });
    this.remoteTracks.set({});
    this.availableTracks.set({});

    this.#pc.getSenders().forEach((sender) => {
      sender.track?.stop();
    });
    // No need to explicitly stop receiver tracks here, as they are managed by remoteTracks cleanup
    this.#pc.close();

    this.#activeSubscriptions.clear();
    this.#usedMids.clear();
    this.#videoRecvMids = [];
    this.#audioRecvMids = [];

    if (message) {
      this.errorMsg.set(message);
    }
    this.status.set(finalStatus);
    console.warn(
      "PulsebeamClient instance has been terminated and is no longer usable.",
    );
  }

  #updateConnectedStatus(): void {
    if (this.#instanceTerminated || this.status.get() !== "connecting") {
      return;
    }

    const pcConnected = this.#pc?.connectionState === "connected";
    const rpcReady = this.#sfuRpcCh?.readyState === "open";

    if (pcConnected && rpcReady) {
      this.status.set("connected");
      this.errorMsg.set(null); // Clear any transient errors from connecting phase
    }
  }

  async connect(room: string, participantId: string): Promise<void> {
    if (this.#instanceTerminated) {
      const errorMessage =
        "This client instance has been terminated and cannot be reused.";
      this.errorMsg.set(errorMessage);
      console.error(errorMessage);
      throw new Error(errorMessage); // More direct feedback to developer
    }

    if (this.status.get() !== "new") {
      const errorMessage =
        `Client can only connect when in "new" state. Current status: ${this.status.get()}. Create a new instance to reconnect.`;
      // Only set error if it's not already a terminal state from a previous attempt on this (now invalid) instance
      if (
        this.status.get() !== "failed" && this.status.get() !== "disconnected"
      ) {
        this.errorMsg.set(errorMessage);
      }
      console.warn(errorMessage);
      return; // Do not proceed
    }

    this.status.set("connecting");
    this.errorMsg.set(null);

    // Signaling
    try {
      const offer = await this.#pc.createOffer();
      await this.#pc.setLocalDescription(offer);
      const response = await fetch(
        `${this.#sfuUrl}?room=${room}&participant=${participantId}`,
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
      this.#terminateInstance(
        "failed",
        error.message || "Signaling process failed unexpectedly.",
      );
    }
  }

  disconnect(): void {
    if (
      this.#instanceTerminated ||
      (this.status.get() !== "connected" && this.status.get() !== "connecting")
    ) {
      // Already terminated, or wasn't in a state that can be "disconnected" (e.g. "new")
      return;
    }
    this.errorMsg.set(null); // Clear error on explicit, clean disconnect attempt
    this.#terminateInstance("disconnected", "User initiated disconnect");
  }

  async publish(track: MediaStreamTrack): Promise<void> {
    if (this.status.get() !== "connected" || this.#instanceTerminated) {
      console.warn(
        "Client not connected or instance terminated. Cannot publish.",
      );
      return;
    }
    const sender = track.kind === "video"
      ? this.#videoSender
      : this.#audioSender;
    try {
      if (sender) {
        await sender.replaceTrack(track);
        (track.kind === "video" ? this.localVideo : this.localAudio).set(track);
      } else {
        throw new Error(`No sender found for ${track.kind} track.`);
      }
    } catch (error: any) {
      this.errorMsg.set(`Publish failed: ${error.message}`);
      console.error("Error during publish:", error);
    }
  }

  async unpublish(kind: "video" | "audio"): Promise<void> {
    // Allow unpublish if instance is being disconnected or is already disconnected/failed, to ensure tracks are cleaned up.
    if (
      this.#instanceTerminated && this.status.get() !== "disconnected" &&
      this.status.get() !== "failed"
    ) {
      return; // Don't operate if terminated for reasons other than explicit disconnect/failure
    }

    const sender = kind === "video" ? this.#videoSender : this.#audioSender;
    const store = kind === "video" ? this.localVideo : this.localAudio;
    try {
      if (sender) await sender.replaceTrack(null);
    } catch (error: any) {
      console.warn(`Warning during unpublish ${kind}: ${error.message}`);
    }
    store.get()?.stop();
    store.set(null);
  }

  subscribe(remoteTrackId: string, kind: "video" | "audio"): boolean {
    if (this.status.get() !== "connected" || this.#instanceTerminated) {
      this.errorMsg.set(
        "Client not connected or instance terminated. Cannot subscribe.",
      );
      return false;
    }
    if (this.#activeSubscriptions.has(remoteTrackId)) {
      console.warn(
        `Already subscribed or attempting to subscribe to remote track: ${remoteTrackId}`,
      );
      return true; // Or false depending on desired strictness
    }

    const protoKind = kind === "video" ? TrackKind.VIDEO : TrackKind.AUDIO;
    const midsPool = protoKind === TrackKind.VIDEO
      ? this.#videoRecvMids
      : this.#audioRecvMids;
    const mid = midsPool.find((m) => !this.#usedMids.has(m));

    if (!mid) {
      this.errorMsg.set(
        `No free ${kind} slot available to subscribe to ${remoteTrackId}.`,
      );
      return false;
    }

    this.#usedMids.add(mid);
    this.#activeSubscriptions.set(remoteTrackId, {
      slotId: mid,
      kind: protoKind,
    });
    this.remoteTracks.setKey(remoteTrackId, {
      slotId: mid,
      remoteTrackId,
      kind,
      track: null,
    });

    const clientSubscribePayload: ClientSubscribePayload = {
      mid,
      trackId: remoteTrackId,
      kind: protoKind,
    };
    if (this.#sfuRpcCh?.readyState === "open") {
      this.#sfuRpcCh.send(
        ClientMessage.toBinary({
          payload: {
            oneofKind: "subscribe",
            subscribe: clientSubscribePayload,
          },
        }),
      );
      return true;
    } else {
      // This should ideally not be reached if status is "connected"
      this.#terminateInstance(
        "failed",
        "SFU RPC channel not open during subscribe attempt.",
      );
      return false;
    }
  }

  unsubscribe(remoteTrackId: string): void {
    // Allow unsubscribe during disconnect/failure for cleanup
    if (
      this.#instanceTerminated && this.status.get() !== "disconnected" &&
      this.status.get() !== "failed"
    ) {
      return;
    }

    const subscriptionInfo = this.#activeSubscriptions.get(remoteTrackId);
    if (!subscriptionInfo) {
      return;
    }

    if (this.#sfuRpcCh?.readyState === "open") {
      const clientUnsubscribePayload: ClientUnsubscribePayload = {
        mid: subscriptionInfo.slotId,
      };
      this.#sfuRpcCh.send(
        ClientMessage.toBinary({
          payload: {
            oneofKind: "unsubscribe",
            unsubscribe: clientUnsubscribePayload,
          },
        }),
      );
    }

    this.#usedMids.delete(subscriptionInfo.slotId);
    this.#activeSubscriptions.delete(remoteTrackId);

    const currentRemoteTrack = this.remoteTracks.get()[remoteTrackId];
    currentRemoteTrack?.track?.stop();
    this.remoteTracks.setKey(remoteTrackId, undefined); // Remove from map
  }

  sendAppData(data: string): boolean {
    if (this.status.get() !== "connected" || this.#instanceTerminated) {
      this.errorMsg.set(
        "Client not connected or instance terminated. Cannot send app data.",
      );
      return false;
    }
    if (!this.#appDataCh || this.#appDataCh.readyState !== "open") {
      this.errorMsg.set(
        "Application DataChannel is not configured or not open.",
      );
      return false;
    }
    try {
      this.#appDataCh.send(data);
      return true;
    } catch (error: any) {
      this.errorMsg.set(`Failed to send app data: ${error.message}`);
      console.error("Error sending app data:", error);
      return false;
    }
  }
}
