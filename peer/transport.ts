import type {
  Ack,
  Message,
  MessageHeader,
  MessagePayload,
  PeerInfo,
} from "./tunnel.ts";
import { ITunnelClient } from "./tunnel.client.ts";
import type { Logger } from "./logger.ts";
import { asleep, joinSignals, retry, RetryOptions } from "./util.ts";
import { RpcOptions } from "@protobuf-ts/runtime-rpc";

const POLL_TIMEOUT_MS = 900000;
const POLL_RETRY_BASE_DELAY_MS = 50;
const POLL_RETRY_MAX_DELAY_MS = 1000;
const MAX_RELIABLE_RETRY_COUNT = 5;
const STREAM_GC_DELAY_MS = 10_000; // just enough to avoid collision and quick enough to reuse connection
const STREAM_GC_INTERVAL_MS = 1_000;

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
  public onmsg = async (_: Message) => {};

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
  public readonly info: PeerInfo;
  private streams: Stream[];
  private abort: AbortController;
  public readonly logger: Logger;
  public readonly asleep: typeof defaultAsleep;
  private readonly randUint32: typeof defaultRandUint32;
  private readonly isRecoverable: typeof defaultIsRecoverable;
  public onstream = (_: Stream) => {};
  public onclosed = (_reason: string) => {};

  constructor(
    private readonly client: ITunnelClient,
    public readonly opts: TransportOptions,
  ) {
    this.asleep = opts.asleep || defaultAsleep;
    this.randUint32 = opts.randUint32 || defaultRandUint32;
    this.isRecoverable = opts.isRecoverable || defaultIsRecoverable;

    this.info = {
      groupId: opts.groupId,
      peerId: opts.peerId,
      connId: this.randUint32(ReservedConnId.Max),
    };
    this.abort = new AbortController();
    this.logger = opts.logger.sub("transport", {
      info: this.info,
    });
    this.streams = [];
  }

  async listen() {
    await Promise.all([
      this.pollLoop(),
      this.gcLoop(),
    ]);
  }

  async gcLoop() {
    while (!this.abort.signal.aborted) {
      // use cooldown period to fully close. Otherwise, there's a chance that the other peer is
      // still sending some messages. In which case, we need to still ignore for some time until completely quiet.
      this.streams = this.streams.filter((s) => !s.isClosed());
      await asleep(STREAM_GC_INTERVAL_MS, this.abort.signal);
    }
    this.logger.debug("gc loop is closed");
  }

  async pollLoop() {
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
        const resp = await retry(async () =>
          await this.client.recv({
            src: this.info,
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
    this.logger.debug("poll loop is closed");
  }

  async close(reason?: string) {
    if (this.abort.signal.aborted) return;
    reason = reason || "transport is closed";
    await Promise.all(this.streams.map((s) => s.close(reason)));
    // Give a chance for graceful shutdown before aborting the connection
    this.abort.abort(reason);
    this.logger.debug("transport is now closed", { reason });
    this.streams = [];
    this.onclosed(reason);
  }

  private handleMessages = (msgs: Message[]) => {
    for (const msg of msgs) {
      this.logger.debug("received", { msg: msg });
      if (this.abort.signal.aborted) return;
      if (!msg.header) continue;
      const src = msg.header.src;
      const dst = msg.header.dst;
      if (!src || !dst) continue;

      if (
        dst.connId >= ReservedConnId.Max &&
        dst.connId != this.info.connId
      ) {
        this.logger.warn(
          "received messages from a stale connection, ignoring",
          { receivedConnID: dst.connId },
        );
        continue;
      }

      let stream: Stream | null = null;
      for (const s of this.streams) {
        if (
          src.groupId === s.other.groupId &&
          src.peerId === s.other.peerId &&
          src.connId === s.other.connId
        ) {
          stream = s;
          break;
        }
      }

      if (!stream) {
        this.logger.debug(
          `session not found, creating one for ${src.peerId}:${src.connId}`,
        );

        if (src.peerId == this.info.peerId) {
          this.logger.warn("loopback detected, ignoring messages");
          return;
        }

        stream = new Stream(
          this,
          this.info,
          src,
          this.logger,
        );
        this.streams.push(stream);
        this.onstream(stream);
      }

      stream.enqueue(msg);
    }
  };

  async connect(
    otherGroupId: string,
    otherPeerId: string,
    signal: AbortSignal,
  ) {
    const payload: MessagePayload = {
      payloadType: {
        oneofKind: "join",
        join: {},
      },
    };
    const header: MessageHeader = {
      src: this.info,
      dst: {
        groupId: otherGroupId,
        peerId: otherPeerId,
        connId: ReservedConnId.Discovery,
      },
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
      await this.asleep(POLL_RETRY_MAX_DELAY_MS, joinedSignal).catch(() => {});

      found = !!this.streams.find((s) =>
        s.other.groupId === otherGroupId && s.other.peerId === otherPeerId
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
      const resp = await retry(async () =>
        await this.client.send(
          { msg },
          rpcOpt,
        ), retryOpt);
      if (resp === null) {
        this.logger.warn("aborted, message dropped from sending", { msg });
        return;
      }

      return;
    } catch (err) {
      this.logger.error("unrecoverable error, force closing", { err });
      this.close();
      return;
    }
  }
}

// Stream allows multiplexing on top of Transport, and
// configuring order and reliability mode
export class Stream {
  public readonly logger: Logger;
  private abort: AbortController;
  public recvq: Queue;
  public ackedbuf: Record<string, boolean>;
  private lastSeqnum: number;
  private closedAt: number;
  public onpayload = async (_: MessagePayload) => {};
  public onclosed = (_reason: string) => {};

  constructor(
    private readonly transport: Transport,
    public readonly info: PeerInfo,
    public readonly other: PeerInfo,
    logger: Logger,
  ) {
    this.logger = logger.sub("stream", {
      other,
    });
    this.abort = new AbortController();
    this.ackedbuf = {};
    this.recvq = new Queue(this.logger);
    this.recvq.onmsg = (msg) => this.handleMessage(msg);
    this.lastSeqnum = 0;
    this.closedAt = 0;
  }

  createSignal(...signals: AbortSignal[]): AbortSignal {
    return joinSignals(this.abort.signal, ...signals);
  }

  isClosed(): boolean {
    const closed = this.abort.signal.aborted &&
      (performance.now() - this.closedAt) > STREAM_GC_DELAY_MS;

    if (closed) {
      this.logger.debug("stream is ready for GC");
    }
    return closed;
  }

  enqueue(msg: Message) {
    if (this.abort.signal.aborted) {
      this.logger.warn(
        "received a message in closed state, ignoring new messages.",
      );
      return;
    }

    this.recvq.enqueue(msg);
  }

  async send(payload: MessagePayload, reliable: boolean, signal?: AbortSignal) {
    if (!signal) {
      signal = this.abort.signal;
    }
    const msg: Message = {
      header: {
        src: this.transport.info,
        dst: this.other,
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

      await this.transport.asleep(
        5 * POLL_RETRY_MAX_DELAY_MS,
        this.abort.signal,
      ).catch(() => {});

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
    }, false).catch((err) =>
      this.logger.warn("failed to send bye", { e: err })
    );
    this.abort.abort(reason);
    this.closedAt = performance.now();
    this.onclosed(reason);
    this.logger.debug("sent bye to the other peer", { reason });
  }
}
