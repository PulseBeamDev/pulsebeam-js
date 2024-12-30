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

const BASE_URL = "https://signal.pulsebeam.dev/twirp";
const PREPARE_INITIAL_DELAY_MS = 50;
const PREPARE_MAX_RETRY = 3;

export type ISession = Pick<
  Session,
  | "addTrack"
  | "removeTrack"
  | "createDataChannel"
  | "connectionState"
  | "ondatachannel"
  | "onconnectionstatechange"
  | "ontrack"
  | "close"
  // abstraction starts here
  | "otherPeerId"
  | "otherConnId"
>;

export interface PeerOptions {
  groupId: string;
  peerId: string;
  token: string;
  baseUrl?: string;
  forceRelay?: boolean;
  iceServers?: RTCIceServer[];
}

export type PeerState = "new" | "closed";

// Peer is a mediator for signaling and all sessions
export class Peer {
  private transport: Transport;
  private readonly logger: Logger;
  private sessions: Session[];
  private _state: PeerState;

  public onsession = (_s: ISession) => { };
  public onstatechange = () => { };
  public readonly peerId: string;

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

  start() {
    if (this._state === "closed") throw new Error("peer is already closed");
    this.transport.listen();
  }

  close() {
    this.sessions = [];
    this.transport.close();
    this.setState("closed");
  }

  connect(otherGroupId: string, otherPeerID: string, signal: AbortSignal) {
    return this.transport.connect(otherGroupId, otherPeerID, signal);
  }

  get state() {
    return this._state;
  }

  private setState(s: PeerState) {
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

export async function createPeer(opts: PeerOptions): Promise<Peer> {
  // TODO: add hook for refresh token
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
  const token = opts.token;

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
