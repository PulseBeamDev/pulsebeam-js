import { type ITunnelClient, TunnelClient } from "./tunnel.client.ts";
import { Transport } from "./transport.ts";
import { DEFAULT_LOG_SINK, Logger, PRETTY_LOG_SINK } from "./logger.ts";
import { Session } from "./session.ts";
import { RpcError, RpcOptions, UnaryCall } from "@protobuf-ts/runtime-rpc";
import {
  TwirpErrorCode,
  TwirpFetchTransport,
} from "@protobuf-ts/twirp-transport";
import { retry } from "./util.ts";

/**
 * Streamline real-time application development.`@pulsebeam/peer` abstracts
 * networking, connection management, and signaling for applications. Built on
 * WebRTC. PulseBeam handles peer-to-peer communication, media/data transmission,
 * and provides infrastructure. 
 *
 * A JavaScript SDK for creating real-time applications with WebRTC.
 *
 * # Features
 * - Flexible connection modes: peer-to-peer or server-relayed.
 * - Support for media (audio/video) and data channels.
 * - Abstracted signaling for establishing WebRTC connections.
 * - Auto-reconnect during disruptions or dropped connections.
 * 
 * For more on PulseBeam, see our docs and quickstart guide:
 * {@link https://pulsebeam.dev/docs/getting-started/}
 * 
 * For more on WebRTC, see the official documentation: 
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API}
 * 
 * # Example Usage
 *
 * Request an authentication token, initialize a peer instance, and establish a connection:
 *
 * ```ts
 * import { Peer, createPeer } from "@pulsebeam/peer";
 *
 * // Step 1: Obtain an auth token
 * const authResponse = await fetch("/auth");
 * const { groupId, peerId, token } = await authResponse.json();
 *
 * // Step 2: Create a Peer instance
 * const peer = await createPeer({ groupId, peerId, token });
 *
 * peer.onsession = (session) => {
 *   session.ontrack = ({ streams }) => console.log("New media stream:", streams);
 *   session.ondatachannel = (event) => console.log("Data channel:", event.channel);
 *   session.onconnectionstatechange = () => console.log("Connection state changed");
 * };
 *
 * // Step 3: Connect to another peer
 * peer.start();
 *
 * const abortController = new AbortController();
 * await peer.connect(groupId, "other-peer-id", abortController.signal);
 * ```
 *
 * This module provides a framework for building WebRTC applications while
 * leaving room for custom implementation details.
 *
 * @module
 */

const BASE_URL = "https://signal.pulsebeam.dev/twirp";
const PREPARE_INITIAL_DELAY_MS = 50;
const PREPARE_MAX_RETRY = 3;

/**
 * The ISession interface is for managing the WebRTC connection between peers.
 *  It provides methods and properties to handle media tracks, data channels, 
 *  connection state, and peer-specific identifiers.
 * 
 * The Session class implements ISession. Session wraps {@link RTCPeerConnection}.
 *  It manages connection complexities by handling tasks like signaling, ICE
 *  candidate negotiation, connection restarts, and lifecycle events.
 * 
 * ISession provides a high-level API for managing peer-to-peer WebRTC
 *  communications while maintaining access to lower-level {@link RTCPeerConnection} 
 *  functionality. This allows full control over media tracks, data channels, and
 *  connection state, enabling developers to build robust real-time communication
 *  features with ease.
 * 
 * Usage:
 *  @example peer.onsession = (session) => {console.log(session)};
 */
export interface ISession {
  /**
   * Adds a media track to the connection. Typically used for sending audio or video.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack}
   * @returns {RTCRtpSender}
   */
  addTrack(...args: Parameters<RTCPeerConnection["addTrack"]>): RTCRtpSender;
  
  /**
   * Removes a media track from the connection. Useful for stopping
   * transmission of a specific track.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/removeTrack}
   * @returns {void}
   */
  removeTrack(...args: Parameters<RTCPeerConnection["removeTrack"]>): void;

  /**
   * Creates a {@link RTCDataChannel} on the connection for arbitrary data transfer.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel}
   */
  createDataChannel(...args: Parameters<RTCPeerConnection["createDataChannel"]>): RTCDataChannel;

  /**
   * Retrieves the current connection state of the underlying RTCPeerConnection 
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState}
   * @returns {RTCPeerConnectionState}
   */
  get connectionState(): RTCPeerConnectionState;

  /**
   * Callback triggered when a {@link RTCDataChannel} is created or received.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ondatachannel}
   * @example peer.onsession = (session) => {
   *  session.ondatachannel = (event) => {
   *      const channel = event.channel;
   *      channel.onmessage = (e) => console.log("Received message:", e.data);
   *  };
   */
  ondatachannel: RTCPeerConnection["ondatachannel"];

  /**
   * Callback triggered when the connection state changes.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onconnectionstatechange}
   */
  onconnectionstatechange: RTCPeerConnection["onconnectionstatechange"];

  /**
   * Callback invoked when a new media track is added to the connection.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ontrack}
   */
  ontrack: RTCPeerConnection["ontrack"];

  /**
   * Closes the session, aborting all pending tasks, and cleaning up resources.
   * Publishes events and logs about the closure.
   * @param reason (optional) A reason for closing the session.
   * @returns {void}
   * @example mysession.close("Session ended by user");
   */
  close(reason?: string): void;

  // Below is PulseBeam specific functionality. Unrelated to 
  //  the underlying RTCPeerConnection

  /** 
   * Retrieves the identifier of the other peer in the connection. 
   * @returns {string} The peer ID of the connected peer.
   * @example console.log(`Connected to peer: ${session.otherPeerId}`);
  */
  get otherPeerId(): string;

  /** 
   * Retrieves the connection identifier for the current connection.
   * Connection IDs are typically unique and help identify connections.
   * @returns {number} The connection ID for the peer connection.
   * @example
   * console.log(`Connection ID: ${mySession.otherConnId}`);
   */
  get otherConnId(): number;
}

/**
 * Options used to configure a Peer.
 * @interface PeerOptions
 * @example
 * const options: PeerOptions = {
 *   groupId: "group-123",
 *   peerId: "peer-456",
 *   token: "eyJhbGciOiJFZERTQSIsImtpZCI6ImFwcF9ZY2w1Q2xSV0pXTnc4YnFCMjVETUgifQ.eyJleHAiOjE3MzU2NzIwMzMsImdyb3VwX2lkIjoiZGVmYXVsdCIsInBlZXJfaWQiOiJhbGljZSIsImFsbG93X2luY29taW5nXzAiOnsiZ3JvdXBfaWQiOiJkZWZhdWx0IiwicGVlcl9pZCI6IioifSwiYWxsb3dfb3V0Z29pbmdfMCI6eyJncm91cF9pZCI6ImRlZmF1bHQiLCJwZWVyX2lkIjoiKiJ9fQ.iJp8UbGOexL2qGEJqBFncen_PKxg3ZgaIz2ILOQc9v58XYxmJzE6d5LRM3Avb3TLIfKk_dG-88wSuE49nLmBCg",
 *   forceRelay: true
 * };
 */
export interface PeerOptions {
  /**
   * Identifier for the group which the peer belongs to.
   * @type {string}
   */
  groupId: string;

  /**
   * Identifier for the peer.
   * @type {string}
   */
  peerId: string;

  /**
   * PulseBeam authentication token for the peer.
   * @type {string}
   */
  token: string;

  /**
   * (Optional) Base URL for API calls. Defaults to useing our servers: "https://signal.pulsebeam.dev/twirp".
   * @type {string | undefined}
   */
  baseUrl?: string;

  /**
   * (Optional) If true, enforces relay-only connections, such as those passed through a TURN server. Defaults to allowing all connection types (such as direct peer to peer). For more details see {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection#icetransportpolicy}
   * @type {boolean | undefined}
   */
  forceRelay?: boolean;

  /**
   * (Optional) Add Ice Servers. Defaults to using our servers. For more details see {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection#iceservers}
   * @type {RTCIceServer[] | undefined}
   */
  iceServers?: RTCIceServer[];
}

/**
 * Represents the possible states for a Peer.
 * 
 * @readonly
 * @enum {string}
 * Possible values:
 *   - `"new"`: The peer has been created.
 *   - `"closed"`: The peer has been closed.
 */
export type PeerState = "new" | "closed";

/**
 * Peer is a mediator for signaling, connecting, and managing sessions.
 */
export class Peer {
  private transport: Transport;
  private readonly logger: Logger;
  private sessions: Session[];
  private _state: PeerState;

  /**
   * Callback invoked when a new session is established.
   * @param _s Session object
   */
  public onsession = (_s: ISession) => { };
  /**
   * Callback invoked when the peer’s state changes.
   */
  public onstatechange = () => { };
  /**
   * Identifier for the peer.
   */
  public readonly peerId: string;

  /**
   * Construct a Peer. Helper available: see {@link createPeer} function 
   * @param logger Logger instance for logging events.
   * @param client Tunnel client for signaling.
   * @param opts Configuration options for the peer.
   * @param isRecoverable Function to determine if an error is recoverable.
   */
  constructor(
    logger: Logger,
    client: ITunnelClient,
    opts: PeerOptions,
    isRecoverable: (_err: unknown) => boolean,
  ) {
    this.peerId = opts.peerId;
    this.logger = logger.sub("peer", { peerId: this.peerId });
    this.sessions = [];
    this._state = "new";

    const rtcConfig: RTCConfiguration = {
      bundlePolicy: "balanced",
      iceTransportPolicy: !!opts.forceRelay ? "relay" : "all",
      iceCandidatePoolSize: 0,
      iceServers: opts.iceServers,
    };
    this.transport = new Transport(client, {
      enableDiscovery: false,
      groupId: opts.groupId,
      peerId: opts.peerId,
      logger: this.logger,
      isRecoverable,
    });
    this.transport.onstream = (s) => {
      const sess = new Session(s, rtcConfig);
      this.sessions.push(sess);
      this.onsession(sess);
    };
    this.transport.onclosed = () => {
      this.close();
    };
  }

  /**
   * Starts the peer, making it ready to establish connections. 
   * Peers must be started before a connection can occur.
   * 
   * @returns {void} 
   * @throws {Error} When the peer was previously closed.
   */
  start() {
    if (this._state === "closed") throw new Error("peer is already closed");
    this.transport.listen();
  }

  /**
   * Closes the peer. Releases associated resources. 
   * Signals to the AbortController passed to connect if connect was called.
   * 
   * @async
   * @returns {Promise<void>} Resolves when the peer has been closed.
   */
  async close() { 
    this.sessions = [];
    await this.transport.close(); 
    this.setState("closed");
  }

  /**
   * Establishes a connection with another peer in the specified group. 
   * Peer should be started before calling connect.
   * 
   * Check the log output for troubleshooting information.
   * 
   * @async
   * @param {string} otherGroupId The ID of the group the other peer belongs to. 
   * @param {string} otherPeerID The ID of the peer you want to connect to.
   * @param {AbortSignal} signal Handle cancellations or cancel the connection attempt. 
   * @returns {Promise<void>} Resolves when the connection has been established, 
   *                          an unrecoverable error (e.g., network connection issues, internal errors) occurs, 
   *                          or the maximum retry attempts are reached. 
   */
  connect(otherGroupId: string, otherPeerID: string, signal: AbortSignal): Promise<void> {
    return this.transport.connect(otherGroupId, otherPeerID, signal);
  }

  /**
   * Gets the current state of the peer. For state info see {@link PeerState}
   * @returns {PeerState} The current state of the peer
   */
  get state(): PeerState {
    return this._state;
  }

  /** internal @private */
  private setState(s: PeerState): void {
    if (s === this._state) return;

    this._state = s;
    this.onstatechange();
  }
}

const TWIRP_FATAL_ERRORS: string[] = [
  TwirpErrorCode[TwirpErrorCode.permission_denied],
  TwirpErrorCode[TwirpErrorCode.invalid_argument],
  TwirpErrorCode[TwirpErrorCode.aborted],
  TwirpErrorCode[TwirpErrorCode.bad_route],
  TwirpErrorCode[TwirpErrorCode.malformed],
  TwirpErrorCode[TwirpErrorCode.not_found],
  TwirpErrorCode[TwirpErrorCode.unauthenticated],
];

function isTwirpRecoverable(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  if (!(err instanceof RpcError)) {
    return true;
  }

  return !TWIRP_FATAL_ERRORS.includes(err.code);
}

/**
 * Helper to create a new Peer instance
 * @param opts Configuration options for the peer.
 * @returns {Promise<Peer>} Resolves to the newly cresated Peer
 * @throws {Error} When unable to connect
 */
export async function createPeer(opts: PeerOptions): Promise<Peer> {
  // TODO: add hook for refresh token
  const token = opts.token;
  const twirp = new TwirpFetchTransport({
    baseUrl: opts.baseUrl || BASE_URL,
    sendJson: false,
    jsonOptions: {
      emitDefaultValues: true, // treat zero values as values instead of undefined.
      enumAsInteger: true,
      ignoreUnknownFields: true,
    },
    interceptors: [
      {
        // adds auth header to unary requests
        interceptUnary(next, method, input, options: RpcOptions): UnaryCall {
          if (!options.meta) {
            options.meta = {};
          }
          options.meta["Authorization"] = `Bearer ${token}`;
          return next(method, input, options);
        },
      },
    ],
  });
  const client = new TunnelClient(twirp);

  const resp = await retry(
    async () => await client.prepare({}),
    {
      baseDelay: 50,
      maxDelay: 1000,
      maxRetries: 5,
      isRecoverable: isTwirpRecoverable,
    },
  );
  if (resp === null) {
    throw new Error("createPeer aborted");
  }
  const iceServers = [...(opts.iceServers || [])];
  for (const s of resp.response.iceServers) {
    iceServers.push({
      urls: s.urls,
      username: s.username,
      credential: s.credential,
    });
  }
  const peer = new Peer(
    new Logger("pulsebeam", undefined, PRETTY_LOG_SINK),
    client,
    { ...opts, "iceServers": iceServers },
    isTwirpRecoverable,
  );
  return peer;
}
