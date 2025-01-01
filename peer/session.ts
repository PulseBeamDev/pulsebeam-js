import {
  type ICECandidate,
  type MessagePayload,
  SdpKind,
  type Signal,
} from "./tunnel.ts";
import { Logger } from "./logger.ts";
import type { Stream } from "./transport.ts";

const ICE_RESTART_MAX_COUNT = 2;
const ICE_RESTART_DEBOUNCE_DELAY_MS = 5000;

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
  private readonly logger: Logger;
  private abort: AbortController;
  private generationCounter: number;
  private iceRestartCount: number;
  private lastIceRestart: number;
  private timers: number[];
  private _closeReason?: string;
  private _connectionState: RTCPeerConnectionState;

  /**
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ondatachannel}
   */
  public ondatachannel: RTCPeerConnection["ondatachannel"] = () => { };

  /**
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onconnectionstatechange}
   */
  public onconnectionstatechange: RTCPeerConnection["onconnectionstatechange"] = () => { };

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
  addTrack(...args: Parameters<RTCPeerConnection["addTrack"]>): RTCRtpSender {
    return this.pc.addTrack(...args);
  }

  /**
   * Removes a media track from the connection.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/removeTrack}
   * @returns {void}
   */
  removeTrack(...args: Parameters<RTCPeerConnection["removeTrack"]>): void {
    return this.pc.removeTrack(...args);
  }

  /**
   * Creates a data channel (useful for sending arbitrary data) through the connection.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel}
   */
  createDataChannel(...args: Parameters<RTCPeerConnection["createDataChannel"]>): RTCDataChannel {
    return this.pc.createDataChannel(...args);
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
  get otherPeerId(): string {
    return this.stream.otherPeerId;
  };

  /** 
   * Retrieves the connection identifier for the connection to the other peer.
   *  Connection ids are usually unique.
   * @returns {number}
   */
  get otherConnId(): number {
    return this.stream.otherConnId;
  }

  /**
   * Closes the session, aborts pending tasks, and cleans up resources.
   *  Publishes events and logs.
   * @param reason (optional) Your reason for closing the session.
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
    this.stream.close();
    this._closeReason = reason;
    this.pc.close();

    // RTCPeerConnection will not emit closed connection. This is a polyfill to get around it.
    // https://stackoverflow.com/questions/66297347/why-does-calling-rtcpeerconnection-close-not-send-closed-event
    const closeEvent = new Event("connectionstatechange");
    this.setConnectionState("closed", closeEvent);

    this.logger.debug("session closed", { connectionState: this.connectionState });
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
    if (this.stream.connId === this.stream.otherConnId) {
      this.impolite = this.stream.peerId > this.stream.otherPeerId;
    } else {
      this.impolite = this.stream.connId > this.stream.otherConnId;
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
    stream.onpayload = (msg) => this.handleMessage(msg);
    stream.onclosed = (reason) => this.close(reason);

    this.pc.oniceconnectionstatechange = async () => {
      const stats = await this.pc.getStats();
      const pair: unknown[] = [];
      const local: unknown[] = [];
      const remote: unknown[] = [];
      // https://developer.mozilla.org/en-US/docs/Web/API/RTCStatsReport#the_statistic_types
      stats.forEach((report: RTCStats) => {
        if (report.type === 'candidate-pair') {
          pair.push(report);
        } else if (report.type === 'local-candidate') {
          local.push(report);
        } else if (report.type === 'remote-candidate') {
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

    let start = performance.now();
    this.pc.onconnectionstatechange = (ev) => {
      this.logger.debug("connectionstate changed", {
        "connectionstate": this.pc.connectionState,
        "iceconnectionstate": this.pc.iceConnectionState,
      });
      switch (this.pc.connectionState) {
        case "connecting":
          start = performance.now();
          break;
        case "connected": {
          const elapsed = performance.now() - start;
          this.logger.debug(`it took ${elapsed}ms to connect`);
          this.iceRestartCount = 0;
          break;
        }
        case "disconnected":
          this.triggerIceRestart();
          break;
        case "failed":
          this.triggerIceRestart();
          break;
        case "closed":
          break;
      }

      this.setConnectionState(this.pc.connectionState, ev);
    };
    let firstOffer = true;
    this.pc.onnegotiationneeded = async () => {
      if (firstOffer) {
        if (!this.impolite) {
          // the impolite always initiates with an offer
          this.stream.send({
            payloadType: {
              oneofKind: "join",
              join: {},
            }
          }, true);
          return;
        }
        firstOffer = false;
      }

      try {
        this.makingOffer = true;
        this.logger.debug("creating an offer");
        await this.pc.setLocalDescription();
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
    };

    this.pc.onicecandidate = ({ candidate }) => {
      this.logger.debug("onicecandidate", { candidate });
      const ice: ICECandidate = {
        candidate: "",
        sdpMLineIndex: 0,
        sdpMid: "",
      };
      if (!candidate || candidate.candidate === "") {
        this.logger.debug("ice gathering is finished");
        return;
      }

      ice.candidate = candidate.candidate;
      ice.sdpMLineIndex = candidate.sdpMLineIndex ?? undefined;
      ice.sdpMid = candidate.sdpMid ?? undefined;
      ice.username = candidate.usernameFragment ?? undefined;

      this.sendSignal({
        data: {
          oneofKind: "iceCandidate",
          iceCandidate: ice,
        },
      });
    };

    this.pc.ondatachannel = (...args) => {
      if (this.ondatachannel) {
        // @ts-ignore: proxy to RTCPeerConnection
        this.ondatachannel(...args);
      }
    };

    this.pc.ontrack = (...args) => {
      if (this.ontrack) {
        // @ts-ignore: proxy to RTCPeerConnection
        this.ontrack(...args);
      }
    };
  }

  /** internal @private */
  private setConnectionState(s: RTCPeerConnectionState, ev: Event): void {
    if (s === this._connectionState) return;

    if (this.onconnectionstatechange) {
      // @ts-ignore: proxy to RTCPeerConnection
      this.onconnectionstatechange(ev);
    }
  }

  private triggerIceRestart = () => {
    // the impolite offer will trigger the polite peer's to also restart Ice
    if (!this.impolite) return;

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
    if (this.iceRestartCount >= ICE_RESTART_MAX_COUNT) this.close();
    this.logger.debug("triggered ICE restart");
    this.pc.restartIce();
    this.generationCounter++;
    this.iceRestartCount++;
    this.lastIceRestart = performance.now();
  }

  private sendSignal = (signal: Omit<Signal, "generationCounter">) => {
    this.stream.send({
      payloadType: {
        oneofKind: "signal",
        signal: { ...signal, generationCounter: this.generationCounter },
      },
    }, true);
  };

  private handleMessage = async (payload: MessagePayload) => {
    if (this.abort.signal.aborted) {
      this.logger.warn("session is closed, ignoring message");
      return;
    }
    switch (payload.payloadType.oneofKind) {
      case "signal":
        await this.handleSignal(payload.payloadType.signal);
        break;
      case "bye":
        this.close();
        break;
      case "join":
        // nothing to do here. SDK consumer needs to manually trigger the start
        break;
    }
  };

  private handleSignal = async (signal: Signal) => {
    if (signal.generationCounter < this.generationCounter) {
      this.logger.warn("detected staled generationCounter signals, ignoring");
      return;
    }

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
        const ice = toIceCandidate(msg.iceCandidate);
        this.pendingCandidates.push(ice);
        this.logger.warn(
          "expecting an offer but got ice candidates during an ICE restart, adding to pending.",
          { ice, msg },
        );
        return;
      }

      this.generationCounter = signal.generationCounter;
    }

    if (msg.oneofKind === "iceCandidate") {
      const ice = toIceCandidate(msg.iceCandidate);
      this.pendingCandidates.push(ice);
      this.checkPendingCandidates();

      return;
    }

    if (msg.oneofKind != "sdp") {
      return;
    }

    const sdp = msg.sdp;
    this.logger.debug("received a SDP signal", { sdpKind: sdp.kind });
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
      await this.pc.setLocalDescription();
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

  private checkPendingCandidates = () => {
    const safeStates: RTCSignalingState[] = [
      "stable",
      "have-local-offer",
      "have-remote-offer",
    ];
    if (!safeStates.includes(this.pc.signalingState) || !this.pc.remoteDescription) {
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
      this.pc.addIceCandidate(candidate).catch(e => {
        this.logger.warn("failed to add candidate, skipping.", { candidate, e });
      });
      this.logger.debug(`added ice: ${candidate.candidate}`);
    }
    this.pendingCandidates = [];
  };
}
