import type {
  Ack,
  Message,
  MessageHeader,
  MessagePayload,
  PeerInfo,
} from "./tunnel.ts";
import {
  ITunnelClient,
} from "./tunnel.client.ts";
import type { Logger } from "./logger.ts";
import { asleep, joinSignals, retry, RetryOptions } from "./util.ts";
import { RpcOptions } from "@protobuf-ts/runtime-rpc";

const POLL_TIMEOUT_MS = 60000;
const POLL_RETRY_BASE_DELAY_MS = 50;
const POLL_RETRY_MAX_DELAY_MS = 1000;
const MAX_RELIABLE_RETRY_COUNT = 5;

export enum ReservedConnId {
  Discovery = 0,
  Max = 16,
}

const defaultAsleep = asleep;
const defaultRandUint32 = (
  reserved: number,
) => (Math.floor(Math.random() * ((2 ** 32) - reserved)) + reserved);
const defaultIsRecoverable = (_err: unknown) => true;

// This is a processing queue that can handle unreliable and reliable messages.
// The processing prioritizes unreliable messages over reliable messages.
// Reliable messages will be always deduplicated, unreliable messages will not be deduped.
class Queue {
  private map: Map<number, [number, Message]>;
  private emitted: Map<number, [number, Message]>;
  private unreliable: Message[];
  private processing: boolean;
  private readonly logger: Logger;
  public onmsg = async (_: Message) => { };

  constructor(logger: Logger) {
    this.logger = logger.sub("queue");
    this.map = new Map();
    this.emitted = new Map();
    this.unreliable = [];
    this.processing = false;
  }

  enqueue(msg: Message) {
    if (!msg.header?.reliable) {
      this.unreliable.push(msg);
    } else {
      const seqnum = msg.header!.seqnum;
      if (this.map.has(seqnum) || this.emitted.has(seqnum)) return;
      this.map.set(seqnum, [performance.now(), msg]);
    }

    // TODO: control queue size by pruning old messages.
    this.processNext();
  }

  async processNext() {
    if (this.processing) return;

    let msg = this.unreliable.pop();
    if (!msg) {
      const res = this.map.entries().next().value;
      if (!res) return;

      const [key, value] = res;
      this.map.delete(key);
      this.emitted.set(key, value);
      const [_, m] = value;
      if (!m.header) return;
      msg = m;
    }

    this.processing = true;
    try {
      await this.onmsg(msg);
    } catch (err) {
      const obj: Record<string, unknown> = { msg };
      if (err instanceof Error) {
        obj["err"] = err;
      }
      this.logger.error("error processing message", obj);
    }
    this.processing = false;
    this.processNext();
  }
}

export interface TransportOptions {
  readonly enableDiscovery: boolean;
  readonly groupId: string;
  readonly peerId: string;
  readonly logger: Logger;
  readonly asleep?: typeof defaultAsleep;
  readonly randUint32?: typeof defaultRandUint32;
  readonly isRecoverable?: typeof defaultIsRecoverable;
}

export class Transport {
  public readonly groupId: string;
  public readonly peerId: string;
  public readonly connId: number;
  private readonly info: PeerInfo;
  private streams: Stream[];
  private abort: AbortController;
  public readonly logger: Logger;
  public readonly asleep: typeof defaultAsleep;
  private readonly randUint32: typeof defaultRandUint32;
  private readonly isRecoverable: typeof defaultIsRecoverable;
  public onstream = (_: Stream) => { };
  public onclosed = (_reason: string) => { };

  constructor(
    private readonly client: ITunnelClient,
    public readonly opts: TransportOptions,
  ) {
    this.asleep = opts.asleep || defaultAsleep;
    this.randUint32 = opts.randUint32 || defaultRandUint32;
    this.isRecoverable = opts.isRecoverable || defaultIsRecoverable;

    this.groupId = opts.groupId;
    this.peerId = opts.peerId;
    this.connId = this.randUint32(ReservedConnId.Max);
    this.info = {
      connId: this.connId,
      enableDiscovery: opts.enableDiscovery,
    };
    this.abort = new AbortController();
    this.logger = opts.logger.sub("transport", {
      groupId: this.opts.groupId,
      peerId: this.opts.peerId,
      connId: this.connId,
    });
    this.streams = [];
  }

  async listen() {
    const rpcOpt: RpcOptions = {
      abort: this.abort.signal,
      timeout: POLL_TIMEOUT_MS,
    };
    const retryOpt: RetryOptions = {
      baseDelay: POLL_RETRY_BASE_DELAY_MS,
      maxDelay: POLL_RETRY_MAX_DELAY_MS,
      maxRetries: -1,
      abortSignal: this.abort.signal,
      isRecoverable: this.isRecoverable,
    };

    while (!this.abort.signal.aborted) {
      try {
        const resp = await retry(async () => await this.client.recv({
          info: this.info,
        }, rpcOpt), retryOpt);
        if (resp === null) {
          break;
        }

        // make sure to not block polling loop
        new Promise(() => this.handleMessages(resp.response.msgs));
      } catch (err) {
        this.logger.error("unrecoverable error, force closing", { err });
        this.close();
        return;
      }
    }
    this.logger.debug("connection closed");
  }

  async close(reason?: string) {
    reason = reason || "transport is closed";
    await Promise.all(this.streams.map((s) => s.close(reason)));
    // Give a chance for graceful shutdown before aborting the connection
    this.abort.abort(reason);
    this.logger.debug("transport is now closed", { reason });
    this.streams = [];
  }

  private handleMessages = (msgs: Message[]) => {
    for (const msg of msgs) {
      this.logger.debug("received", { msg: msg });
      if (this.abort.signal.aborted) return;
      if (!msg.header) continue;

      if (
        msg.header.otherConnId >= ReservedConnId.Max &&
        msg.header.otherConnId != this.connId
      ) {
        this.logger.warn(
          "received messages from a stale connection, ignoring",
          { receivedConnID: msg.header!.otherConnId },
        );
        continue;
      }

      let stream: Stream | null = null;
      for (const s of this.streams) {
        if (
          msg.header.groupId === s.otherGroupId &&
          msg.header.peerId === s.otherPeerId &&
          msg.header.connId === s.otherConnId
        ) {
          stream = s;
          break;
        }
      }

      if (!stream) {
        this.logger.debug(
          `session not found, creating one for ${msg.header.peerId}:${msg.header.connId}`,
        );

        if (msg.header.peerId == this.peerId) {
          this.logger.warn("loopback detected, ignoring messages");
          return;
        }

        stream = new Stream(
          this,
          msg.header.groupId,
          msg.header.peerId,
          msg.header.connId,
          this.logger,
        );
        this.streams.push(stream);
        this.onstream(stream);
      }

      stream.recvq.enqueue(msg);
    }
  };

  async connect(otherGroupId: string, otherPeerId: string, signal: AbortSignal) {
    const payload: MessagePayload = {
      payloadType: {
        oneofKind: "join",
        join: {},
      },
    };
    const header: MessageHeader = {
      groupId: this.groupId,
      peerId: this.peerId,
      connId: this.connId,
      otherGroupId: otherGroupId,
      otherPeerId: otherPeerId,
      otherConnId: ReservedConnId.Discovery,
      seqnum: 0,
      reliable: false,
    };

    let found = false;
    const joinedSignal = joinSignals(signal, this.abort.signal);
    while (!joinedSignal.aborted && !found) {
      await this.send(joinedSignal, {
        header,
        payload,
      });
      await this.asleep(POLL_RETRY_MAX_DELAY_MS, joinedSignal).catch(() => { });

      found = !!this.streams.find((s) =>
        s.otherGroupId === otherGroupId && s.otherPeerId === otherPeerId
      );
    }
  }

  async send(signal: AbortSignal, msg: Message) {
    const joinedSignal = joinSignals(signal, this.abort.signal);
    const rpcOpt: RpcOptions = {
      abort: joinedSignal,
      timeout: POLL_TIMEOUT_MS,
    };
    const retryOpt: RetryOptions = {
      baseDelay: POLL_RETRY_BASE_DELAY_MS,
      maxDelay: POLL_RETRY_MAX_DELAY_MS,
      maxRetries: -1,
      abortSignal: joinedSignal,
      isRecoverable: this.isRecoverable,
    };

    try {
      const resp = await retry(async () => await this.client.send(
        { msg }, rpcOpt), retryOpt);
      if (resp === null) {
        this.logger.warn("aborted, message dropped from sending", { msg });
        return;
      }

      this.logger.debug("sent", { msg });
      return;
    } catch (err) {
      this.logger.error("unrecoverable error, force closing", { err });
      this.close();
      return;
    }
  }

  onstreamclosed(closed: Stream) {
    // TODO: use cooldown period to fully close. Otherwise, there's a chance that the other peer is
    // still sending some messages. In which case, we need to still ignore for some time until completely quiet.

    // streams are created by transport. Thus, its object reference is the same.
    this.streams = this.streams.filter((s) => s != closed);
    this.logger.debug("stream has been closed", { streams: this.streams });
  }
}

// Stream allows multiplexing on top of Transport, and
// configuring order and reliability mode
export class Stream {
  public readonly logger: Logger;
  private abort: AbortController;
  public recvq: Queue;
  public ackedbuf: Record<string, boolean>;
  public readonly groupId: string;
  public readonly peerId: string;
  public readonly connId: number;
  private lastSeqnum: number;
  public onpayload = async (_: MessagePayload) => { };
  public onclosed = (_reason: string) => { };

  constructor(
    private readonly transport: Transport,
    public readonly otherGroupId: string,
    public readonly otherPeerId: string,
    public readonly otherConnId: number,
    logger: Logger,
  ) {
    this.logger = logger.sub("stream", {
      otherGroupId,
      otherPeerId,
      otherConnId,
    });
    this.groupId = transport.groupId;
    this.peerId = transport.peerId;
    this.connId = transport.connId;
    this.abort = new AbortController();
    this.ackedbuf = {};
    this.recvq = new Queue(this.logger);
    this.recvq.onmsg = (msg) => this.handleMessage(msg);
    this.lastSeqnum = 0;
  }

  createSignal(...signals: AbortSignal[]): AbortSignal {
    return joinSignals(this.abort.signal, ...signals);
  }

  async send(payload: MessagePayload, reliable: boolean, signal?: AbortSignal) {
    if (!signal) {
      signal = this.abort.signal;
    }
    const msg: Message = {
      header: {
        groupId: this.transport.groupId,
        peerId: this.transport.peerId,
        connId: this.transport.connId,
        otherGroupId: this.otherGroupId,
        otherPeerId: this.otherPeerId,
        otherConnId: this.otherConnId,
        seqnum: 0,
        reliable,
      },
      payload: { ...payload },
    };

    if (!reliable) {
      await this.transport.send(signal, msg);
      return;
    }

    this.lastSeqnum++;
    msg.header!.seqnum = this.lastSeqnum;
    this.ackedbuf[msg.header!.seqnum] = false; // marked as unacked
    const resendLimit = MAX_RELIABLE_RETRY_COUNT;
    let tryCount = resendLimit;
    const seqnum = msg.header!.seqnum;

    // TODO: abort when generation counter doesn't match
    while (!signal.aborted) {
      await this.transport.send(this.abort.signal, msg);

      await this.transport.asleep(5 * POLL_RETRY_MAX_DELAY_MS, this.abort.signal
      ).catch(() => { });

      // since ackedbuf doesn't delete the seqnum right away, it prevents from racing between
      // resending and acknolwedging
      if (this.ackedbuf[seqnum]) {
        break;
      }

      if (tryCount <= 0) {
        const message = "reached the maximum resend limit, dropping message";
        this.logger.warn(message, {
          seqnum,
          resendLimit,
          reliable,
        });
        throw new Error(message);
      }

      tryCount--;
      this.logger.debug("resending", { ...msg.header });
    }
  }

  private async handleMessage(msg: Message) {
    const payload = msg.payload!.payloadType;
    switch (payload.oneofKind) {
      case "ack":
        this.handleAck(payload.ack);
        break;
      case "bye":
        this.close("received bye from other peer");
        break;
      case undefined:
        break;
      default: {
        if (msg.header!.reliable) {
          const ack: Ack = {
            ackRanges: [{
              seqnumStart: msg.header!.seqnum,
              seqnumEnd: msg.header!.seqnum + 1,
            }],
          };
          const reply: MessagePayload = {
            payloadType: { oneofKind: "ack", ack },
          };
          this.logger.debug("ack", { seqnum: msg.header!.seqnum });
          this.send(reply, false);
        }

        if (!msg.payload) return;
        await this.onpayload(msg.payload!);
        break;
      }
    }
  }

  handleAck(ack: Ack) {
    for (const r of ack.ackRanges) {
      for (let s = r.seqnumStart; s < r.seqnumEnd; s++) {
        this.logger.debug("received ack", { seqnum: s });
        this.ackedbuf[s] = true; // marked as acked
      }
    }
  }

  async close(reason?: string) {
    if (this.abort.signal.aborted) return;
    reason = reason || "session is closed";
    // make sure to give a chance to send a message
    await this.send({
      payloadType: {
        oneofKind: "bye",
        bye: {},
      },
    }, false).catch(err => this.logger.warn("failed to send bye", { e: err }));
    this.abort.abort(reason);
    this.transport.onstreamclosed(this);
    this.onclosed(reason);
    this.logger.debug("sent bye to the other peer", { reason });
  }
}
