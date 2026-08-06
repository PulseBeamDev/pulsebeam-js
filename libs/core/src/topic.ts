import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import {
  RelMsgSchema,
  RelDeliverySchema,
  RelNackSchema,
  RelControlSchema,
} from "./gen/reliable_pb";

// ─── Public types ────────────────────────────────────────────────────────────

export type TopicDelivery =
  | { type: "message"; publisherId: string; streamId: bigint; seq: bigint; payload: Uint8Array }
  | { type: "resync"; publisherId: string; newStreamId: bigint };

// ─── Internal: async queue ───────────────────────────────────────────────────

class AsyncQueue<T> {
  private items: T[] = [];
  private waiting: ((r: IteratorResult<T>) => void) | null = null;
  private done = false;

  push(item: T) {
    if (this.done) return;
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: item, done: false });
    } else {
      this.items.push(item);
    }
  }

  next(): Promise<IteratorResult<T>> {
    if (this.items.length > 0) {
      return Promise.resolve({ value: this.items.shift()!, done: false });
    }
    if (this.done) {
      return Promise.resolve({ value: undefined as unknown as T, done: true });
    }
    return new Promise((resolve) => { this.waiting = resolve; });
  }

  close() {
    this.done = true;
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: undefined as unknown as T, done: true });
    }
  }
}

function makeIterator<T>(queue: AsyncQueue<T>): AsyncIterator<T> {
  return {
    next: () => queue.next(),
    return: () => {
      queue.close();
      return Promise.resolve({ value: undefined as unknown as T, done: true });
    },
  };
}

// ─── Latest (unreliable) ─────────────────────────────────────────────────────

export class DataPublisher {
  private dc: RTCDataChannel | null = null;

  constructor(readonly topic: string) {}

  /** @internal */
  _attachDc(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = "arraybuffer";
  }

  send(payload: Uint8Array): void {
    if (this.dc?.readyState === "open") {
      this.dc.send(payload);
    }
  }
}

export class DataSubscriber implements AsyncIterable<Uint8Array> {
  private queue = new AsyncQueue<Uint8Array>();

  constructor(
    readonly topic: string,
    readonly publisherId: string | null = null,
  ) {}

  /** @internal */
  _attachDc(dc: RTCDataChannel) {
    dc.binaryType = "arraybuffer";
    dc.onmessage = (ev) => this.queue.push(new Uint8Array(ev.data as ArrayBuffer));
  }

  [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    return makeIterator(this.queue);
  }

  close() { this.queue.close(); }
}

// ─── Ordered (reliable + NACK) ───────────────────────────────────────────────

const RETRANSMIT_BUFFER = 256;

export class OrderedTopicPublisher {
  private dc: RTCDataChannel | null = null;
  private streamId = 0n;
  private seq = 0n;
  private buffer: Array<{ seq: bigint; payload: Uint8Array }> = [];

  constructor(readonly topic: string) {}

  /** @internal */
  _attachDc(dc: RTCDataChannel) {
    this.dc = dc;
    this.streamId++;
    this.seq = 0n;
    this.buffer = [];
    dc.binaryType = "arraybuffer";
    dc.onmessage = (ev) => this._handleNack(new Uint8Array(ev.data as ArrayBuffer));
  }

  private _handleNack(data: Uint8Array) {
    try {
      const ctrl = fromBinary(RelControlSchema, data);
      if (ctrl.msg.case !== "nack") return;
      const { streamId, fromSeq, publisherId: _ } = ctrl.msg.value;
      if (streamId !== this.streamId) return;

      const oldest = this.buffer[0]?.seq ?? this.seq;
      if (fromSeq < oldest) {
        // Gap too large — signal resync
        if (this.dc?.readyState === "open") {
          this.dc.send(toBinary(RelMsgSchema, create(RelMsgSchema, {
            streamId: this.streamId, seq: this.seq, resyncRequired: true,
          })));
        }
        return;
      }
      for (const entry of this.buffer) {
        if (entry.seq >= fromSeq && this.dc?.readyState === "open") {
          this.dc.send(toBinary(RelMsgSchema, create(RelMsgSchema, {
            streamId: this.streamId, seq: entry.seq, payload: entry.payload,
          })));
        }
      }
    } catch { /* ignore decode errors */ }
  }

  send(payload: Uint8Array): void {
    if (!this.dc || this.dc.readyState !== "open") return;
    const seq = this.seq++;
    this.dc.send(toBinary(RelMsgSchema, create(RelMsgSchema, {
      streamId: this.streamId, seq, payload,
    })));
    this.buffer.push({ seq, payload });
    if (this.buffer.length > RETRANSMIT_BUFFER) this.buffer.shift();
  }
}

export class OrderedTopicSubscriber implements AsyncIterable<TopicDelivery> {
  private queue = new AsyncQueue<TopicDelivery>();
  private dc: RTCDataChannel | null = null;
  private perPublisher = new Map<string, { expectedSeq: bigint; streamId: bigint }>();

  constructor(readonly topic: string) {}

  /** @internal */
  _attachDc(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = "arraybuffer";
    dc.onmessage = (ev) => this._handleMessage(new Uint8Array(ev.data as ArrayBuffer));
  }

  private _nack(streamId: bigint, fromSeq: bigint, publisherId: string) {
    if (this.dc?.readyState !== "open") return;
    this.dc.send(toBinary(RelControlSchema, create(RelControlSchema, {
      msg: { case: "nack", value: create(RelNackSchema, { streamId, fromSeq, publisherId }) },
    })));
  }

  private _handleMessage(data: Uint8Array) {
    try {
      const delivery = fromBinary(RelDeliverySchema, data);
      const { publisherId, frame } = delivery;
      const msg = fromBinary(RelMsgSchema, frame);

      let state = this.perPublisher.get(publisherId);

      if (!state) {
        // Start from wherever the publisher currently is — no catch-up replay.
        // Initializing to 0n would trigger a NACK for every message already
        // sent, replaying the publisher's buffer to a subscriber that never
        // asked for history.
        state = { expectedSeq: msg.seq, streamId: msg.streamId };
        this.perPublisher.set(publisherId, state);
      }

      if (msg.resyncRequired || msg.streamId !== state.streamId) {
        state.streamId = msg.streamId;
        state.expectedSeq = msg.seq + 1n;
        this.queue.push({ type: "resync", publisherId, newStreamId: msg.streamId });
        return;
      }

      if (msg.seq < state.expectedSeq) return; // duplicate

      if (msg.seq > state.expectedSeq) {
        const gap = msg.seq - state.expectedSeq;
        if (gap > BigInt(RETRANSMIT_BUFFER)) {
          // Unrecoverable gap
          state.expectedSeq = msg.seq + 1n;
          this.queue.push({ type: "resync", publisherId, newStreamId: msg.streamId });
        } else {
          this._nack(msg.streamId, state.expectedSeq, publisherId);
        }
        return;
      }

      // In-order delivery
      state.expectedSeq = msg.seq + 1n;
      this.queue.push({
        type: "message",
        publisherId,
        streamId: msg.streamId,
        seq: msg.seq,
        payload: msg.payload,
      });
    } catch { /* ignore decode errors */ }
  }

  [Symbol.asyncIterator](): AsyncIterator<TopicDelivery> {
    return makeIterator(this.queue);
  }

  close() { this.queue.close(); }
}

// ─── Builders ────────────────────────────────────────────────────────────────

// Both publishers and subscribers CREATE their own labeled DCs — the SFU sees
// both ends and routes data from `v1/rt/pub/<topic>` into `v1/rt/sub/<topic>`.
// Neither side waits for ondatachannel.
export interface TopicTransportHandle {
  registerDataChannel(
    label: string,
    init: RTCDataChannelInit,
    onNewDc: (dc: RTCDataChannel) => void,
  ): void;
}

export class PublisherBuilder {
  constructor(private name: string, private handle: TopicTransportHandle) {}

  latest(): DataPublisher {
    const pub = new DataPublisher(this.name);
    this.handle.registerDataChannel(
      `v1/rt/pub/${this.name}`,
      { ordered: false, maxRetransmits: 0 },
      (dc) => pub._attachDc(dc),
    );
    return pub;
  }

  ordered(): OrderedTopicPublisher {
    const pub = new OrderedTopicPublisher(this.name);
    this.handle.registerDataChannel(
      `v1/rel/pub/${this.name}`,
      { ordered: true },
      (dc) => pub._attachDc(dc),
    );
    return pub;
  }
}

export class SubscriberBuilder {
  private _publisherId: string | null = null;

  constructor(private name: string, private handle: TopicTransportHandle) {}

  fromPublisher(id: string): this {
    this._publisherId = id;
    return this;
  }

  latest(): DataSubscriber {
    const label = this._publisherId
      ? `v1/rt/sub/${this.name}/${this._publisherId}`
      : `v1/rt/sub/${this.name}`;
    const sub = new DataSubscriber(this.name, this._publisherId);
    // Subscriber creates its own DC; SFU routes publisher data into it.
    this.handle.registerDataChannel(label, { ordered: false, maxRetransmits: 0 }, (dc) => sub._attachDc(dc));
    return sub;
  }

  ordered(): OrderedTopicSubscriber {
    const sub = new OrderedTopicSubscriber(this.name);
    this.handle.registerDataChannel(`v1/rel/sub/${this.name}`, { ordered: true }, (dc) => sub._attachDc(dc));
    return sub;
  }
}

export class Topic {
  constructor(private name: string, private handle: TopicTransportHandle) {}

  publisher(): PublisherBuilder {
    return new PublisherBuilder(this.name, this.handle);
  }

  subscriber(): SubscriberBuilder {
    return new SubscriberBuilder(this.name, this.handle);
  }
}
