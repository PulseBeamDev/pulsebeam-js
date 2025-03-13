/**
 * skip these tests in favor of embedding foss server
import { afterEach, describe, expect, it } from "vitest";
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import {
  ReservedConnId,
  Transport,
  type TransportOptions,
} from "./transport.ts";
import {
  type Message,
  PrepareReq,
  PrepareResp,
  type RecvReq,
  RecvResp,
  type SendReq,
  SendResp,
} from "./signaling.ts";
import { type ISignalingClient, SignalingClient } from "./signaling.client.ts";
import type { ServerStreamingCall, UnaryCall } from "@protobuf-ts/runtime-rpc";
import type { RpcOptions } from "@protobuf-ts/runtime-rpc";
import { Logger, PRETTY_LOG_SINK } from "./logger.ts";
import { asleep } from "./util.ts";

async function waitFor(
  conditionFn: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 50,
): Promise<void> {
  const start = performance.now();

  while ((performance.now() - start) < timeout) {
    if (await conditionFn()) {
      return;
    }
    await asleep(interval);
  }

  throw new Error(`waitFor: condition not met within ${timeout}ms`);
}

class Channel<T> {
  private queue: T[];

  constructor(private readonly logger: Logger) {
    this.queue = [];
  }

  send(value: T) {
    this.queue.push(value);
    this.logger.info("push", { length: this.queue.length });
  }

  async receive(signal?: AbortSignal): Promise<T[]> {
    this.logger.info("checking queue");
    if (!signal) {
      const ac = new AbortController();
      signal = ac.signal;
      setTimeout(ac.abort, 1000);
    }

    while (!signal.aborted && this.queue.length === 0) {
      this.logger.info("queue state", { length: this.queue.length });
      await asleep(50);
    }

    this.logger.info("queue filled", { length: this.queue.length });
    const msgs = this.queue;
    this.queue = [];
    return msgs;
  }
}

class SharedState {
  private readonly queues: Map<string, Channel<Message>>;

  constructor(
    private readonly logger: Logger,
  ) {
    this.queues = new Map();
  }

  getq(id: string) {
    let q = this.queues.get(id);
    if (!q) {
      q = new Channel(this.logger.sub("queue", { id }));
      this.queues.set(id, q);
      this.logger.info("new queue", {
        id,
        queues: this.queues.size,
      });
    }

    return q;
  }
}

class MockClient implements ISignalingClient {
  constructor(
    private readonly logger: Logger,
    private readonly groupId: string,
    private readonly peerId: string,
    private readonly state: SharedState,
  ) { }

  prepare(
    _input: PrepareReq,
    _options?: RpcOptions,
  ): UnaryCall<PrepareReq, PrepareResp> {
    // @ts-ignore: mock obj
    return null;
  }

  send(
    input: SendReq,
    _options?: RpcOptions,
  ): UnaryCall<SendReq, SendResp> {
    const msg = input.msg!;
    const hdr = msg.header!;
    const otherId = `${hdr.src?.groupId}:${hdr.dst?.peerId}`;
    this.state.getq(otherId).send(msg);

    // @ts-ignore: mock obj
    return Promise.resolve({}).then((response) => ({
      response,
    }));
  }

  recv(
    input: RecvReq,
    options?: RpcOptions,
  ): ServerStreamingCall<RecvReq, RecvResp> {
  }
}

function createClient(
  groupId: string,
  peerId: string,
  state?: SharedState,
): ISignalingClient {
  if (state) {
    return new MockClient(
      new Logger("MockClient", {}, PRETTY_LOG_SINK),
      groupId,
      peerId,
      state,
    );
  }

  const grpc = new GrpcWebFetchTransport({
    baseUrl: "http://localhost:3000/grpc",
  });
  const client = new SignalingClient(grpc);
  return client;
}

describe("util", () => {
  it("should wait for stream count", async () => {
    let streamCount = 0;
    setTimeout(() => {
      streamCount++;
    }, 200);
    await waitFor(() => (streamCount > 0));
    expect(streamCount).toBeGreaterThan(0);
  });
});

describe("channel", () => {
  it("should send and receive all messages", async () => {
    const logger = new Logger("channel_test", {}, PRETTY_LOG_SINK);
    const ch = new Channel<number>(logger);
    ch.send(1);
    ch.send(2);

    const res = await ch.receive();
    expect(res.length).toBe(2);
    expect(res[0]).toBe(1);
    expect(res[1]).toBe(2);
  });

  it("should send and receive all messages with async", async () => {
    const logger = new Logger("channel_test", {}, PRETTY_LOG_SINK);
    const ch = new Channel<number>(logger);

    setTimeout(() => {
      ch.send(1);
      ch.send(2);
    }, 100);

    const res = await ch.receive();
    expect(res.length).toBe(2);
    expect(res[0]).toBe(1);
    expect(res[1]).toBe(2);
  });
});

describe("transport", () => {
  afterEach(() => asleep(100)); // make sure all timers have exited

  it("should receive join", async () => {
    const logger = new Logger("test", {}, PRETTY_LOG_SINK);
    const state = new SharedState(logger.sub("state"));
    const clientA = createClient("default", "peerA", state);
    const clientB = createClient("default", "peerB", state);
    const opts: TransportOptions = {
      enableDiscovery: false,
      groupId: "default",
      peerId: "peerA",
      logger,
      asleep: (ms, opts) => asleep(ms / 100, opts), // speedup by 100x
    };
    const peerA = new Transport(clientA, opts);
    const peerB = new Transport(clientB, { ...opts, peerId: "peerB" });
    let streamCountA = 0;
    let payloadCountA = 0;
    let streamCountB = 0;
    peerA.onstream = (s) => {
      expect(s.other.peerId).toBe(peerB.info.peerId);
      expect(s.other.connId).toBe(peerB.info.connId);
      streamCountA++;

      s.onpayload = () => {
        payloadCountA++;
        return Promise.resolve();
      };
    };
    peerB.onstream = (s) => {
      expect(s.other.peerId).toBe(peerA.info.peerId);
      expect(s.other.connId).toBe(peerA.info.connId);
      streamCountB++;

      s.send({
        payloadType: {
          oneofKind: "join",
          join: {},
        },
      }, true);
    };

    peerA.listen();
    peerB.listen();

    const ac = new AbortController();
    peerA.connect("default", "peerB", ac.signal);

    await waitFor(() => streamCountA > 0 && streamCountB > 0);
    await asleep(100);

    let closeCountA = 0;
    let closeCountB = 0;
    peerA.onclosed = () => {
      closeCountA++;
    };
    peerB.onclosed = () => {
      closeCountB++;
    };

    peerA.close();
    peerB.close();

    expect(streamCountA).toBe(1);
    expect(streamCountB).toBe(1);
    expect(payloadCountA).toBe(1);

    await asleep(100);
    expect(closeCountA).toBe(1);
    expect(closeCountB).toBe(1);
  });
});
*/
