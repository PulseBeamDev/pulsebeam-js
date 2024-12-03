import { afterEach, describe, expect, it } from "vitest";
import { TwirpFetchTransport } from "@protobuf-ts/twirp-transport";
import {
  ReservedConnId,
  Transport,
  type TransportOptions,
} from "./transport.ts";
import {
  PrepareReq,
  PrepareResp,
  type Message,
  type RecvReq,
  type RecvResp,
  type SendReq,
  type SendResp,
} from "./tunnel.ts";
import { type ITunnelClient, TunnelClient } from "./tunnel.client.ts";
import type { UnaryCall } from "@protobuf-ts/runtime-rpc";
import type { RpcOptions } from "@protobuf-ts/runtime-rpc";
import { Logger } from "./logger.ts";
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

class MockClient implements ITunnelClient {
  private readonly queues: Record<string, Message[]>;

  constructor(private readonly groupId: string, private readonly peerId: string) {
    this.queues = {};
  }

  getq(id: string) {
    const q = this.queues[id] || [];
    this.queues[id] = q;
    return q;
  }

  prepare(_input: PrepareReq, _options?: RpcOptions): UnaryCall<PrepareReq, PrepareResp> {
    // @ts-ignore: mock obj
    return null;
  }

  send(input: SendReq, _options?: RpcOptions): UnaryCall<SendReq, SendResp> {
    const msg = input.msg!;
    const hdr = msg.header!;
    const id = `${hdr.groupId}:${hdr.peerId}:${hdr.connId}`;
    const otherId = `${hdr.groupId}:${hdr.otherPeerId}:${hdr.otherConnId}`;
    this.getq(otherId).push(msg);

    const recv = this.getq(id).pop();
    const msgs: Message[] = [];
    if (recv) msgs.push(recv);

    // @ts-ignore: mock obj
    return Promise.resolve({ response: { msgs } });
  }

  recv(input: RecvReq, options?: RpcOptions): UnaryCall<RecvReq, RecvResp> {
    const id = `${this.groupId}:${this.peerId}:${input.info?.connId}`;
    const discoveryId = `${this.groupId}:${this.peerId}:${ReservedConnId.Discovery}`;
    const msgs: Message[] = [];
    const resp = { response: { msgs } };
    const signal = options?.abort;

    // @ts-ignore: mock obj
    return waitFor(
      () => {
        let recv = this.getq(id).pop();
        if (recv) msgs.push(recv);
        recv = this.getq(discoveryId).pop();
        if (recv) msgs.push(recv);
        const aborted = !!signal && signal.aborted;
        return msgs.length > 0 || aborted;
      },
    )
      .catch(() => resp)
      .then(() => resp);
  }
}

function createClient(groupId: string, peerId: string, mock: boolean): ITunnelClient {
  if (mock) {
    return new MockClient(groupId, peerId);
  }

  const twirp = new TwirpFetchTransport({
    baseUrl: "http://localhost:3000/twirp",
    sendJson: false,
  });
  const client = new TunnelClient(twirp);
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

describe("transport", () => {
  afterEach(() => asleep(100)); // make sure all timers have exited

  it("should receive join", async () => {
    const logger = new Logger("test", {});
    const clientA = createClient("default", "peerA", true);
    const clientB = createClient("default", "peerB", true);
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
      expect(s.otherPeerId).toBe(peerB.peerId);
      expect(s.otherConnId).toBe(peerB.connId);
      streamCountA++;

      s.onpayload = () => {
        payloadCountA++;
        return Promise.resolve();
      };
    };
    peerB.onstream = (s) => {
      expect(s.otherPeerId).toBe(peerA.peerId);
      expect(s.otherConnId).toBe(peerA.connId);
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

    peerA.close();
    peerB.close();

    expect(streamCountA).toBe(1);
    expect(streamCountB).toBe(1);
    expect(payloadCountA).toBe(1);
  });
});
