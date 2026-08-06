import { describe, expect, it, vi } from "vitest";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import {
  RelMsgSchema,
  RelDeliverySchema,
  RelControlSchema,
  RelNackSchema,
} from "../src/gen/reliable_pb";
import {
  DataPublisher,
  DataSubscriber,
  OrderedTopicPublisher,
  OrderedTopicSubscriber,
} from "../src/topic";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDc(label = "test") {
  let onmessage: ((ev: { data: ArrayBuffer }) => void) | null = null;
  const sent: ArrayBuffer[] = [];
  const dc = {
    label,
    binaryType: "arraybuffer",
    readyState: "open" as RTCDataChannelState,
    get onmessage() { return onmessage; },
    set onmessage(fn) { onmessage = fn; },
    send: vi.fn((data: ArrayBuffer | Uint8Array) => {
      sent.push(data instanceof Uint8Array ? data.buffer : data);
    }),
    // Simulate receiving a message
    receive(data: Uint8Array) { onmessage?.({ data: data.buffer }); },
    get sent() { return sent; },
    get sentUint8Arrays() { return sent.map(b => new Uint8Array(b)); },
  };
  return dc;
}

function encodeDelivery(publisherId: string, msg: {
  streamId?: bigint; seq?: bigint; payload?: Uint8Array; resyncRequired?: boolean
}) {
  const relMsg = create(RelMsgSchema, {
    streamId: msg.streamId ?? 0n,
    seq: msg.seq ?? 0n,
    payload: msg.payload ?? new Uint8Array(),
    resyncRequired: msg.resyncRequired ?? false,
  });
  return toBinary(RelDeliverySchema, create(RelDeliverySchema, {
    publisherId,
    frame: toBinary(RelMsgSchema, relMsg),
  }));
}

// ─── DataPublisher (latest) ───────────────────────────────────────────────────

describe("DataPublisher (latest)", () => {
  it("sends raw bytes on the datachannel", () => {
    const pub = new DataPublisher("test");
    const dc = makeDc();
    pub._attachDc(dc as unknown as RTCDataChannel);
    const payload = new Uint8Array([1, 2, 3]);
    pub.send(payload);
    expect(dc.send).toHaveBeenCalledOnce();
    expect(new Uint8Array(dc.sent[0]!)).toEqual(payload);
  });

  it("silently drops send when channel is not open", () => {
    const pub = new DataPublisher("test");
    const dc = makeDc();
    dc.readyState = "closed";
    pub._attachDc(dc as unknown as RTCDataChannel);
    pub.send(new Uint8Array([1]));
    expect(dc.send).not.toHaveBeenCalled();
  });

  it("silently drops send before any DC is attached", () => {
    const pub = new DataPublisher("test");
    expect(() => pub.send(new Uint8Array([1]))).not.toThrow();
  });
});

// ─── DataSubscriber (latest) ─────────────────────────────────────────────────

describe("DataSubscriber (latest)", () => {
  it("delivers received bytes through the async iterator", async () => {
    const sub = new DataSubscriber("test");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    dc.receive(new Uint8Array([10, 20]));
    dc.receive(new Uint8Array([30, 40]));

    const iter = sub[Symbol.asyncIterator]();
    const a = await iter.next();
    const b = await iter.next();
    expect(a.value).toEqual(new Uint8Array([10, 20]));
    expect(b.value).toEqual(new Uint8Array([30, 40]));
  });

  it("close() terminates the iterator", async () => {
    const sub = new DataSubscriber("test");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    const iter = sub[Symbol.asyncIterator]();
    const nextPromise = iter.next(); // waiting
    sub.close();
    const result = await nextPromise;
    expect(result.done).toBe(true);
  });
});

// ─── OrderedTopicPublisher ────────────────────────────────────────────────────

describe("OrderedTopicPublisher", () => {
  it("encodes RelMsg with incrementing seq numbers", () => {
    const pub = new OrderedTopicPublisher("events");
    const dc = makeDc();
    pub._attachDc(dc as unknown as RTCDataChannel);

    pub.send(new Uint8Array([1]));
    pub.send(new Uint8Array([2]));
    pub.send(new Uint8Array([3]));

    expect(dc.send).toHaveBeenCalledTimes(3);
    const msgs = dc.sentUint8Arrays.map(b => fromBinary(RelMsgSchema, b));
    expect(msgs.map(m => m.seq)).toEqual([0n, 1n, 2n]);
    expect(msgs[0]!.payload).toEqual(new Uint8Array([1]));
  });

  it("increments streamId on each DC attachment (reconnect)", () => {
    const pub = new OrderedTopicPublisher("events");
    const dc1 = makeDc();
    pub._attachDc(dc1 as unknown as RTCDataChannel);
    pub.send(new Uint8Array([1]));
    const streamId1 = fromBinary(RelMsgSchema, dc1.sentUint8Arrays[0]!).streamId;

    const dc2 = makeDc();
    pub._attachDc(dc2 as unknown as RTCDataChannel);
    pub.send(new Uint8Array([2]));
    const streamId2 = fromBinary(RelMsgSchema, dc2.sentUint8Arrays[0]!).streamId;

    expect(streamId2).toBeGreaterThan(streamId1);
  });

  it("retransmits buffered messages on NACK", () => {
    const pub = new OrderedTopicPublisher("events");
    const dc = makeDc();
    pub._attachDc(dc as unknown as RTCDataChannel);

    pub.send(new Uint8Array([0])); // seq 0
    pub.send(new Uint8Array([1])); // seq 1
    pub.send(new Uint8Array([2])); // seq 2
    const countBefore = dc.sent.length;

    // Simulate NACK for seq 1
    const nackBytes = toBinary(RelControlSchema, create(RelControlSchema, {
      msg: { case: "nack", value: create(RelNackSchema, { streamId: 1n, fromSeq: 1n }) },
    }));
    dc.receive(new Uint8Array(nackBytes));

    // Should retransmit seq 1 and seq 2 (only the new sends after the NACK)
    const retransmitted = dc.sentUint8Arrays.slice(countBefore).map(b => fromBinary(RelMsgSchema, b));
    expect(retransmitted.map(m => m.seq)).toEqual([1n, 2n]);
  });

  it("sends resync_required when NACK requests before buffer window", () => {
    const pub = new OrderedTopicPublisher("events");
    const dc = makeDc();
    pub._attachDc(dc as unknown as RTCDataChannel);

    // Send 3 messages (buffer holds them)
    pub.send(new Uint8Array([0]));
    pub.send(new Uint8Array([1]));
    pub.send(new Uint8Array([2]));
    dc.send.mockClear();

    // NACK for seq 0, but clear the buffer to simulate overflow
    // We do this by sending 257+ messages to evict seq 0 from the circular buffer
    const bigPub = new OrderedTopicPublisher("events2");
    const dc2 = makeDc();
    bigPub._attachDc(dc2 as unknown as RTCDataChannel);
    for (let i = 0; i < 257; i++) bigPub.send(new Uint8Array([i % 256]));
    const countBefore = dc2.sent.length;

    // NACK requesting something before the buffer window (seq 0 was evicted)
    const nackBytes = toBinary(RelControlSchema, create(RelControlSchema, {
      msg: { case: "nack", value: create(RelNackSchema, { streamId: 1n, fromSeq: 0n }) },
    }));
    dc2.receive(new Uint8Array(nackBytes));

    const newSent = dc2.sentUint8Arrays.slice(countBefore).map(b => fromBinary(RelMsgSchema, b));
    expect(newSent.length).toBe(1);
    expect(newSent[0]!.resyncRequired).toBe(true);
  });
});

// ─── OrderedTopicSubscriber ───────────────────────────────────────────────────

describe("OrderedTopicSubscriber", () => {
  it("delivers in-order messages", async () => {
    const sub = new OrderedTopicSubscriber("events");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    for (let i = 0; i < 3; i++) {
      dc.receive(encodeDelivery("alice", { seq: BigInt(i), payload: new Uint8Array([i]) }));
    }

    const iter = sub[Symbol.asyncIterator]();
    for (let i = 0; i < 3; i++) {
      const { value } = await iter.next();
      expect(value.type).toBe("message");
      if (value.type === "message") {
        expect(value.seq).toBe(BigInt(i));
        expect(value.payload).toEqual(new Uint8Array([i]));
      }
    }
  });

  it("sends a NACK when a gap is detected", async () => {
    const sub = new OrderedTopicSubscriber("events");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    dc.receive(encodeDelivery("alice", { seq: 0n }));
    dc.receive(encodeDelivery("alice", { seq: 3n })); // gap: expecting 1

    // Should have sent a NACK for fromSeq=1
    expect(dc.send).toHaveBeenCalled();
    const nackMsg = fromBinary(RelControlSchema, dc.sentUint8Arrays.at(-1)!);
    expect(nackMsg.msg.case).toBe("nack");
    if (nackMsg.msg.case === "nack") {
      expect(nackMsg.msg.value.fromSeq).toBe(1n);
    }
  });

  it("emits resync on stream_id change", async () => {
    const sub = new OrderedTopicSubscriber("events");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    dc.receive(encodeDelivery("alice", { streamId: 1n, seq: 0n }));
    dc.receive(encodeDelivery("alice", { streamId: 2n, seq: 0n })); // new stream

    const iter = sub[Symbol.asyncIterator]();
    const first = await iter.next();
    const second = await iter.next();

    expect(first.value.type).toBe("message");
    expect(second.value.type).toBe("resync");
    if (second.value.type === "resync") {
      expect(second.value.newStreamId).toBe(2n);
      expect(second.value.publisherId).toBe("alice");
    }
  });

  it("emits resync on resync_required flag", async () => {
    const sub = new OrderedTopicSubscriber("events");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    dc.receive(encodeDelivery("alice", { seq: 0n, resyncRequired: true }));

    const { value } = await sub[Symbol.asyncIterator]().next();
    expect(value.type).toBe("resync");
  });

  it("close() terminates the iterator", async () => {
    const sub = new OrderedTopicSubscriber("events");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    const iter = sub[Symbol.asyncIterator]();
    const pending = iter.next();
    sub.close();
    const result = await pending;
    expect(result.done).toBe(true);
  });

  it("late-join: does not NACK for history before subscription (no replay)", () => {
    // Regression: initializing expectedSeq=0n caused a NACK for all messages
    // the publisher had already sent, replaying them to a subscriber that just joined.
    const sub = new OrderedTopicSubscriber("events");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    // First message this subscriber ever sees is seq=42 (publisher already has history)
    dc.receive(encodeDelivery("alice", { streamId: 1n, seq: 42n, payload: new Uint8Array([42]) }));

    // Must NOT have sent a NACK — subscriber starts from seq=42, not 0
    expect(dc.send).not.toHaveBeenCalled();
  });

  it("late-join: delivers the first seen message immediately without gap handling", async () => {
    const sub = new OrderedTopicSubscriber("events");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    dc.receive(encodeDelivery("alice", { streamId: 1n, seq: 42n, payload: new Uint8Array([42]) }));
    dc.receive(encodeDelivery("alice", { streamId: 1n, seq: 43n, payload: new Uint8Array([43]) }));

    const iter = sub[Symbol.asyncIterator]();
    const a = await iter.next();
    const b = await iter.next();
    expect(a.value.type).toBe("message");
    expect(b.value.type).toBe("message");
    if (a.value.type === "message") expect(a.value.seq).toBe(42n);
    if (b.value.type === "message") expect(b.value.seq).toBe(43n);
    expect(dc.send).not.toHaveBeenCalled();
  });

  it("ignores duplicate / out-of-order messages", async () => {
    const sub = new OrderedTopicSubscriber("events");
    const dc = makeDc();
    sub._attachDc(dc as unknown as RTCDataChannel);

    dc.receive(encodeDelivery("alice", { seq: 0n, payload: new Uint8Array([0]) }));
    dc.receive(encodeDelivery("alice", { seq: 0n, payload: new Uint8Array([99]) })); // dup

    const iter = sub[Symbol.asyncIterator]();
    const { value } = await iter.next();
    // Only one message delivered
    if (value.type === "message") {
      expect(value.payload).toEqual(new Uint8Array([0]));
    }

    // No second item yet (duplicate was dropped)
    let resolved = false;
    const pending = iter.next().then(() => { resolved = true; });
    await Promise.resolve(); // drain microtask queue
    expect(resolved).toBe(false);
    void pending; // prevent unhandled promise
  });
});
