import {
  AnalyticsMetrics,
  AnalyticsReport,
  ErrorEvent,
  type ICECandidate,
  IceCandidateEvent,
  MediaHandlingEvent,
  type PeerInfo,
  SdpKind,
  type Signal,
  SignalingEvent,
} from "./signaling.ts";
import { Logger } from "./logger.ts";
import type { Stream } from "./transport.ts";
import * as analytics from "./analytics.ts";

const ICE_RESTART_MAX_COUNT = 1;
const ICE_RESTART_DEBOUNCE_DELAY_MS = 5000;
const INTERNAL_DATA_CHANNEL = "__internal";

function toIceCandidate(ice: ICECandidate): RTCIceCandidateInit {
  return {
    candidate: ice.candidate,
    sdpMid: ice.sdpMid,
    sdpMLineIndex: ice.sdpMLineIndex,
    usernameFragment: ice.password,
  };
}

function toSDPType(kind: SdpKind): RTCSdpType {
  switch (kind) {
    case SdpKind.OFFER:
      return "offer";
    case SdpKind.ANSWER:
      return "answer";
    case SdpKind.PRANSWER:
      return "pranswer";
    case SdpKind.ROLLBACK:
      return "rollback";
    default:
      throw new Error(`unexpected kind: ${kind}`);
  }
}

function fromSDPType(t: RTCSdpType): SdpKind {
  switch (t) {
    case "offer":
      return SdpKind.OFFER;
    case "answer":
      return SdpKind.ANSWER;
    case "pranswer":
      return SdpKind.PRANSWER;
    case "rollback":
      return SdpKind.ROLLBACK;
    default:
      throw new Error(`unexpected sdp type: ${t}`);
  }
}

/**
 * The Session class is a wrapper around RTCPeerConnection designed to manage
 *  WebRTC connections, signaling, and ICE candidates. It handles negotiation,
 *  ICE restarts, signaling messages, and connection lifecycle events.
 */
export class Session {
  private pc: RTCPeerConnection;
  private makingOffer: boolean;
  private impolite: boolean;
  private pendingCandidates: RTCIceCandidateInit[];
  private iceBatcher: IceCandidateBatcher;
  private readonly logger: Logger;
  private abort: AbortController;
  private generationCounter: number;
  private iceRestartCount: number;
  private lastIceRestart: number;
  private timers: number[];
  private _closeReason?: string;
  private _connectionState: RTCPeerConnectionState;
  private internalDataChannel: RTCDataChannel;
  private _metrics: AnalyticsMetrics[];

  /**
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ondatachannel}
   */
  public ondatachannel: RTCPeerConnection["ondatachannel"] = () => { };

  /**
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onconnectionstatechange}
   */
  public onconnectionstatechange: RTCPeerConnection["onconnectionstatechange"] =
    () => { };

  /**
   * Callback invoked when a new media track is added to the connection.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ontrack}
   */
  public ontrack: RTCPeerConnection["ontrack"] = () => { };

  /**
   * Adds a media track to the connection.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack}
   * @returns {RTCRtpSender} the newly created track
   */
  addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): RTCRtpSender {
    if (track.kind === "audio") {
      this.recordEvent({
        mediaHandlingEvent: MediaHandlingEvent.MEDIA_LOCAL_VIDEO_TRACK_ADDED,
      });
    } else if (track.kind === "video") {
      this.recordEvent({
        mediaHandlingEvent: MediaHandlingEvent.MEDIA_LOCAL_VIDEO_TRACK_ADDED,
      });
    }
    return this.pc.addTrack(track, ...streams);
  }

  /**
   * The getSenders() method of the RTCPeerConnection interface returns an array of RTCRtpSender objects,
   * each of which represents the RTP sender responsible for transmitting one track's data.
   * A sender object provides methods and properties for examining and controlling the encoding and transmission of the track's data.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getSenders}
   * @returns {RTCRtpSender[]}
   */
  getSenders(): RTCRtpSender[] {
    return this.pc.getSenders();
  }

  /**
   * Removes a media track from the connection.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/removeTrack}
   * @returns {void}
   */
  removeTrack(sender: RTCRtpSender): void {
    if (sender.track?.kind === "audio") {
      this.recordEvent({
        mediaHandlingEvent: MediaHandlingEvent.MEDIA_LOCAL_AUDIO_TRACK_REMOVED,
      });
    } else if (sender.track?.kind === "video") {
      this.recordEvent({
        mediaHandlingEvent: MediaHandlingEvent.MEDIA_LOCAL_VIDEO_TRACK_REMOVED,
      });
    }
    return this.pc.removeTrack(sender);
  }

  /**
   * Creates a data channel (useful for sending arbitrary data) through the connection.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel}
   */
  createDataChannel(
    ...args: Parameters<RTCPeerConnection["createDataChannel"]>
  ): RTCDataChannel {
    return this.pc.createDataChannel(...args);
  }

  getStats(
    ...args: Parameters<RTCPeerConnection["getStats"]>
  ): Promise<RTCStatsReport> {
    return this.pc.getStats(...args);
  }

  /**
   * Returns the current connection state of the underlying RTCPeerConnection
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState}
   * @returns {RTCPeerConnectionState}
   */
  get connectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  /**
   * If reason is available, returns the reason for the session being closed.
   * @returns {string | undefined}
   */
  get closeReason(): string | undefined {
    return this._closeReason;
  }

  /**
   * Retrieves the identifier of the other peer.
   * @returns {string}
   */
  get other(): PeerInfo {
    return {
      groupId: this.stream.other.groupId,
      peerId: this.stream.other.peerId,
      connId: this.stream.other.connId,
    };
  }

  /**
   * Closes the session, aborts pending tasks, and cleans up resources.
   * Publishes events and logs.
   * @param {string} [reason] - (optional) Your reason for closing the session.
   * @returns {void}
   * @example mysession.close("Normal closure");
   */
  close(reason?: string): void {
    if (this.abort.signal.aborted) return;
    this.abort.abort(reason);
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];
    this.iceBatcher.close();
    this.stream.close();
    this._closeReason = reason;
    this.pc.close();

    // RTCPeerConnection will not emit closed connection. This is a polyfill to get around it.
    // https://stackoverflow.com/questions/66297347/why-does-calling-rtcpeerconnection-close-not-send-closed-event
    const closeEvent = new Event("connectionstatechange");
    this.setConnectionState("closed", closeEvent);

    this.logger.debug("session closed", {
      connectionState: this.connectionState,
      reason,
    });
  }

  /**
   * Creates a Session with the provided stream and
   *  configs. Sets up event handlers, signaling, and ICE candidate
   *  management.
   * See {@link Session} For class responsibilities
   * @param stream Represents the transport stream for signaling messages.
   * @param config Configuration object for the RTCPeerConnection.
   */
  constructor(
    private readonly stream: Stream,
    config: RTCConfiguration,
  ) {
    this.pc = new RTCPeerConnection(config);

    this.makingOffer = false;
    this.pendingCandidates = [];
    // Higher is impolite. [0-15] is reserved. One of the reserved value can be used
    // for implementing fixed "polite" role for lite ICE.
    if (this.stream.info.connId === this.stream.other.connId) {
      this.impolite = this.stream.info.peerId > this.stream.other.peerId;
    } else {
      this.impolite = this.stream.info.connId > this.stream.other.connId;
    }
    this.abort = new AbortController();
    this.logger = stream.logger.sub("session", {
      role: this.impolite ? "impolite" : "polite",
    });
    this.generationCounter = 0;
    this.iceRestartCount = 0;
    this.lastIceRestart = 0;
    this.timers = [];
    this._connectionState = "new";
    this._metrics = [];
    this.iceBatcher = new IceCandidateBatcher(
      this.logger,
      100,
      (c) => this.sendLocalIceCandidates(c),
    );
    stream.onsignal = (msg) => this.handleSignal(msg);
    stream.onclosed = (reason) => this.close(reason);

    this.pc.oniceconnectionstatechange = async () => {
      const stats = await this.pc.getStats();
      const pair: unknown[] = [];
      const local: unknown[] = [];
      const remote: unknown[] = [];
      // https://developer.mozilla.org/en-US/docs/Web/API/RTCStatsReport#the_statistic_types
      stats.forEach((report: RTCStats) => {
        if (report.type === "candidate-pair") {
          pair.push(report);
        } else if (report.type === "local-candidate") {
          local.push(report);
        } else if (report.type === "remote-candidate") {
          remote.push(report);
        }
      });

      this.logger.debug("iceconnectionstate changed", {
        "connectionstate": this.pc.connectionState,
        "iceconnectionstate": this.pc.iceConnectionState,
        local,
        remote,
        pair,
        pending: this.pendingCandidates,
      });
    };

    this.pc.onsignalingstatechange = () => {
      this.checkPendingCandidates();
    };

    let start = performance.now();
    this.pc.onconnectionstatechange = (ev) => {
      this.logger.debug("connectionstate changed", {
        "connectionstate": this.pc.connectionState,
        "iceconnectionstate": this.pc.iceConnectionState,
      });
      this.setConnectionState(this.pc.connectionState, ev);
      switch (this.pc.connectionState) {
        case "new":
          break;
        case "connecting":
          start = performance.now();
          break;
        case "connected": {
          const elapsed = performance.now() - start;
          this.logger.debug(`it took ${elapsed}ms to connect`);
          this.recordEvent({
            iceCandidateEvent: IceCandidateEvent.ICE_CANDIDATE_PAIRING_SUCCESS,
          });
          this.iceRestartCount = 0;
          break;
        }
        case "disconnected":
          break;
        case "failed":
          this.recordEvent({
            errorEvent: ErrorEvent.ERROR_ICE_CONNECTION_FAILED,
          });
          this.triggerIceRestart();
          break;
        case "closed":
          break;
      }
    };
    this.pc.onnegotiationneeded = this.onnegotiationneeded.bind(this);
    this.pc.onicecandidate = ({ candidate }) => {
      // Record specific candidate types found
      if (candidate) {
        // Use the specific local candidate found events based on type
        switch (candidate.type) {
          case "host":
            this.recordEvent({
              iceCandidateEvent:
                IceCandidateEvent.ICE_CANDIDATE_LOCAL_HOST_FOUND,
            });
            break;
          case "srflx":
            this.recordEvent({
              iceCandidateEvent:
                IceCandidateEvent.ICE_CANDIDATE_LOCAL_SRFLX_FOUND,
            });
            break;
          case "prflx":
            // Note: Local prflx is less common, browser might report as host/srflx after STUN checks
            this.recordEvent({
              iceCandidateEvent:
                IceCandidateEvent.ICE_CANDIDATE_LOCAL_PRFLX_FOUND,
            });
            break;
          case "relay":
            this.recordEvent({
              iceCandidateEvent:
                IceCandidateEvent.ICE_CANDIDATE_LOCAL_RELAY_FOUND,
            }); // Assuming REFLEXIVE meant RELAY based on common usage
            break;
          default:
            this.logger.warn("Unknown local ICE candidate type", {
              type: candidate.type,
            });
            break;
        }
      } else {
        // ICE Gathering Complete
        this.recordEvent({
          iceCandidateEvent:
            IceCandidateEvent.ICE_CANDIDATE_GATHERING_COMPLETED,
        });
      }
      this.iceBatcher.addCandidate(candidate);
    };

    this.pc.ondatachannel = (ev) => {
      if (ev.channel.label === INTERNAL_DATA_CHANNEL) {
        return;
      }

      if (this.ondatachannel) {
        // @ts-ignore: proxy to RTCPeerConnection
        this.ondatachannel(ev);
      }
    };

    this.pc.ontrack = (ev) => {
      if (ev.track.kind === "audio") {
        this.recordEvent({
          mediaHandlingEvent: MediaHandlingEvent.MEDIA_REMOTE_AUDIO_TRACK_ADDED,
        });
      } else if (ev.track.kind === "video") {
        this.recordEvent({
          mediaHandlingEvent: MediaHandlingEvent.MEDIA_REMOTE_VIDEO_TRACK_ADDED,
        });
      }

      if (this.ontrack) {
        // @ts-ignore: proxy to RTCPeerConnection
        this.ontrack(ev);
      }
    };

    this.internalDataChannel = this.pc.createDataChannel(INTERNAL_DATA_CHANNEL);
    // NOTE: reserve internal data channel usage
    this.internalDataChannel;
  }

  private recordEvent(metric: Omit<AnalyticsMetrics, "timestampUs">) {
    const now = analytics.now();
    this._metrics.push({
      ...metric,
      timestampUs: now,
    });
  }

  public async collectMetrics(): Promise<AnalyticsReport> {
    const rawStats = await this.getStats();
    const quality = analytics.calculateQualityScore(rawStats);
    if (!!quality) {
      this.recordEvent({
        qualityScore: quality.qualityScore,
        rttUs: quality.rttUs,
      });
    }

    const buffered = this._metrics;
    this._metrics = [];
    return {
      tags: {
        src: this.stream.info,
        dst: this.other,
      },
      metrics: buffered,
    };
  }

  private async onnegotiationneeded() {
    try {
      this.recordEvent({
        signalingEvent: SignalingEvent.SIGNALING_NEGOTIATION_NEEDED,
      });
      this.makingOffer = true;
      this.logger.debug("creating an offer");

      await this.setLocalDescription();
      if (!this.pc.localDescription) {
        throw new Error("expect localDescription to be not empty");
      }

      this.sendSignal({
        data: {
          oneofKind: "sdp",
          sdp: {
            kind: fromSDPType(this.pc.localDescription.type),
            sdp: this.pc.localDescription.sdp,
          },
        },
      });
    } catch (err) {
      if (err instanceof Error) {
        this.logger.error("failed in negotiating", { err });
      }
    } finally {
      this.makingOffer = false;
    }
  }

  private sendLocalIceCandidates(candidates: RTCIceCandidate[]) {
    const batch: ICECandidate[] = [];
    for (const candidate of candidates) {
      const ice: ICECandidate = {
        candidate: "",
        sdpMLineIndex: 0,
        sdpMid: "",
      };

      ice.candidate = candidate.candidate;
      ice.sdpMLineIndex = candidate.sdpMLineIndex ?? undefined;
      ice.sdpMid = candidate.sdpMid ?? undefined;
      ice.username = candidate.usernameFragment ?? undefined;
      batch.push(ice);
    }

    this.sendSignal({
      data: {
        oneofKind: "iceCandidateBatch",
        iceCandidateBatch: {
          candidates: batch,
        },
      },
    });
  }

  /** internal @private */
  private setConnectionState(s: RTCPeerConnectionState, ev: Event): void {
    if (s === this._connectionState) return;

    if (this.onconnectionstatechange) {
      // @ts-ignore: proxy to RTCPeerConnection
      this.onconnectionstatechange(ev);
    }
  }

  private async setLocalDescription() {
    const transceivers = this.pc.getTransceivers();
    for (const transceiver of transceivers) {
      if (transceiver.receiver.track.kind !== "video") {
        continue;
      }

      // https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/setCodecPreferences
      const preferredOrder = [
        "video/AV1",
        "video/VP9",
        "video/VP8",
        "video/H264",
      ];
      const codecs = RTCRtpReceiver.getCapabilities("video")?.codecs || [];
      const preferences = codecs.sort((a, b) => {
        const indexA = preferredOrder.indexOf(a.mimeType);
        const indexB = preferredOrder.indexOf(b.mimeType);
        const orderA = indexA >= 0 ? indexA : Number.MAX_VALUE;
        const orderB = indexB >= 0 ? indexB : Number.MAX_VALUE;
        return orderA - orderB;
      });
      transceiver.setCodecPreferences(preferences);
    }

    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind !== "video") {
        continue;
      }

      // https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters
      const parameters = sender.getParameters();
      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}]; // Initialize if empty
      }

      parameters.encodings[0].maxBitrate = 400 * 1000;
      try {
        await sender.setParameters(parameters);
      } catch (e) {
        this.logger.warn("failed to change max bitrate", { error: e });
      }
    }

    try {
      await this.pc.setLocalDescription();
    } catch (e) {
      this.recordEvent({
        errorEvent: ErrorEvent.ERROR_SDP_NEGOTIATION_FAILED,
      });
      throw e;
    }
  }

  private triggerIceRestart = () => {
    // // the impolite offer will trigger the polite peer's to also restart Ice
    // if (!this.impolite) return;
    //
    const elapsed = performance.now() - this.lastIceRestart;
    if (elapsed < ICE_RESTART_DEBOUNCE_DELAY_MS) {
      // schedule ice restart after some delay;
      const delay = ICE_RESTART_DEBOUNCE_DELAY_MS - elapsed;
      const timerId = window.setTimeout(() => {
        this.triggerIceRestart();
        this.timers = this.timers.filter((v) => v === timerId);
      }, delay);
      return;
    }

    if (this.pc.connectionState === "connected") return;
    if (this.iceRestartCount >= ICE_RESTART_MAX_COUNT) {
      this.close("detected sustained network failure");
      return;
    }
    this.logger.debug("triggered ICE restart");
    this.pc.restartIce();
    this.recordEvent({
      signalingEvent: SignalingEvent.SIGNALING_ICE_RESTART_TRIGGERED,
    });

    this.generationCounter++;
    this.iceRestartCount++;
    this.lastIceRestart = performance.now();
  };

  private sendSignal = (signal: Omit<Signal, "generationCounter">) => {
    if (signal.data.oneofKind === "sdp") {
      const sdpKind = signal.data.sdp.kind;
      if (sdpKind === SdpKind.OFFER) {
        this.recordEvent({
          signalingEvent: SignalingEvent.SIGNALING_OFFER_SENT,
        });
      } else if (sdpKind === SdpKind.ANSWER) {
        this.recordEvent({
          signalingEvent: SignalingEvent.SIGNALING_ANSWER_SENT,
        });
      }
    }

    this.stream.send({
      payloadType: {
        oneofKind: "signal",
        signal: { ...signal, generationCounter: this.generationCounter },
      },
    }, true);
  };

  private handleSignal = async (signal: Signal) => {
    if (signal.generationCounter < this.generationCounter) {
      this.logger.warn("detected staled generationCounter signals, ignoring");
      return;
    }

    this.addCandidates(signal);
    const msg = signal.data;
    if (signal.generationCounter > this.generationCounter) {
      // Sync generationCounter so this peer can reset its state machine
      // to start accepting new offers
      this.logger.debug("detected new generationCounter", {
        otherGenerationCounter: signal.generationCounter,
        generationCounter: this.generationCounter,
        msg,
      });

      if (msg.oneofKind === "iceCandidate") {
        this.logger.warn(
          "expecting an offer but got ice candidates during an ICE restart, adding to pending.",
          { msg },
        );
        return;
      }

      this.generationCounter = signal.generationCounter;
    }

    if (msg.oneofKind != "sdp") {
      return;
    }

    const sdp = msg.sdp;
    this.logger.debug("received a SDP signal", { sdpKind: sdp.kind });
    if (sdp.kind === SdpKind.OFFER) {
      this.recordEvent({
        signalingEvent: SignalingEvent.SIGNALING_OFFER_RECEIVED,
      });
    } else if (sdp.kind === SdpKind.ANSWER) {
      this.recordEvent({
        signalingEvent: SignalingEvent.SIGNALING_ANSWER_RECEIVED,
      });
    }

    const offerCollision = sdp.kind === SdpKind.OFFER &&
      (this.makingOffer || this.pc.signalingState !== "stable");

    const ignoreOffer = this.impolite && offerCollision;
    if (ignoreOffer) {
      this.logger.debug("ignored offer");
      return;
    }

    this.logger.debug("creating an answer");
    await this.pc.setRemoteDescription({
      type: toSDPType(sdp.kind),
      sdp: sdp.sdp,
    });
    if (sdp.kind === SdpKind.OFFER) {
      await this.setLocalDescription();
      if (!this.pc.localDescription) {
        this.logger.error("unexpected null local description");
        return;
      }

      // when a signal is retried many times and still failing. The failing heartbeat will kick in and close.
      this.sendSignal({
        data: {
          oneofKind: "sdp",
          sdp: {
            kind: fromSDPType(this.pc.localDescription.type),
            sdp: this.pc.localDescription.sdp,
          },
        },
      });
    }
    this.checkPendingCandidates();
    return;
  };

  private addCandidates(msg: Signal) {
    const candidates = [];
    if (msg.data.oneofKind === "iceCandidate") {
      candidates.push(msg.data.iceCandidate);
    } else if (msg.data.oneofKind === "iceCandidateBatch") {
      candidates.push(...msg.data.iceCandidateBatch.candidates);
    } else {
      return;
    }

    this.pendingCandidates.push(...candidates.map((v) => toIceCandidate(v)));
    this.checkPendingCandidates();
  }

  private checkPendingCandidates = () => {
    const safeStates: RTCSignalingState[] = [
      "stable",
      "have-local-offer",
      "have-remote-offer",
    ];
    if (
      !safeStates.includes(this.pc.signalingState) || !this.pc.remoteDescription
    ) {
      this.logger.debug("wait for adding pending candidates", {
        signalingState: this.pc.signalingState,
        iceConnectionState: this.pc.iceConnectionState,
        connectionState: this.pc.connectionState,
        remoteDescription: this.pc.remoteDescription,
        pendingCandidates: this.pendingCandidates.length,
      });
      return;
    }

    for (const candidate of this.pendingCandidates) {
      if (!candidate.candidate || candidate.candidate === "") {
        continue;
      }

      // intentionally not awaiting, otherwise we might be in a different state than we originally
      // checked.
      this.pc.addIceCandidate(candidate).catch((e) => {
        this.logger.warn("failed to add candidate, skipping.", {
          candidate,
          e,
        });
      });
      this.logger.debug(`added ice: ${candidate.candidate}`);
    }
    this.pendingCandidates = [];
  };
}

class IceCandidateBatcher {
  private candidates: RTCIceCandidate[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private delayMs: number;
  private logger: Logger;
  private onIceCandidates: (candidates: RTCIceCandidate[]) => void;

  constructor(
    logger: Logger,
    delayMs: number,
    onIceCandidates: (candidates: RTCIceCandidate[]) => void,
  ) {
    this.logger = logger.sub("icebatcher");
    this.delayMs = delayMs;
    this.onIceCandidates = onIceCandidates;
  }

  public addCandidate = (candidate: RTCIceCandidate | null): void => {
    if (!candidate || candidate.candidate === "") {
      this.logger.debug(
        "ice gathering is finished, force flush local candidates",
      );
      this.flushCandidates();
      return;
    }

    this.logger.debug("onicecandidate", { candidate });
    this.candidates.push(candidate);
    if (!this.timeoutId) {
      // First candidate received, start the timer
      this.timeoutId = setTimeout(this.flushCandidates, this.delayMs);
    } else {
      // Subsequent candidate received, reset the timer
      clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(this.flushCandidates, this.delayMs);
    }
  };

  private flushCandidates = (): void => {
    if (this.candidates.length > 0) {
      this.onIceCandidates(this.candidates);
      this.candidates = [];
    }
    this.timeoutId = null;
  };

  public flush = (): void => {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.flushCandidates();
  };

  public close = (): void => {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  };
}
