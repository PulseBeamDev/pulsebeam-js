// End-to-end media encryption via WebRTC Encoded Transforms.
//
// Each RTP frame's payload is encrypted on the sender and decrypted on the
// receiver, so the SFU only ever forwards ciphertext — it cannot read the
// codec bitstream. That is exactly why the SFU forwards on the Dependency
// Descriptor (an RTP header extension, added by the packetizer *after* this
// transform runs and therefore always in the clear): it is the only signal
// left for keyframe detection and temporal shedding once the payload is opaque.
//
// This is transport-level E2EE (AES-GCM per frame), not a full RFC 9605 SFrame
// implementation: there is no built-in key negotiation, ratcheting, or MLS.
// Supplying and rotating the key is the application's responsibility — every
// participant that shares a key can decrypt, and the SFU (holding no key)
// cannot. `unencryptedHeaderBytes` leaves a small per-frame-type prefix in the
// clear so the codec's frame structure survives packetization.

const IV_BYTES = 12;

export type FrameKind = "key" | "delta" | "other";

/** Bytes left unencrypted at the head of each frame, by frame type. */
export type UnencryptedHeaderBytes = Record<FrameKind, number>;

// VP8/VP9-style defaults from the WebRTC insertable-streams sample; enough of
// the frame header stays in the clear for packetization to work. H.264 callers
// may need to tune these for their packetization mode.
export const DEFAULT_UNENCRYPTED_HEADER_BYTES: UnencryptedHeaderBytes = {
  key: 10,
  delta: 3,
  other: 1,
};

export function importKeyFromBytes(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt a frame payload, leaving `headerBytes` at the front untouched.
 * Layout of the result: `[header][iv(12)][ciphertext+tag][headerLen(1)]`.
 *
 * The header length is appended as the final byte so the decrypter is
 * self-describing: it need not — and must not — infer the offset from
 * `frame.type`, because the receiver cannot read the (encrypted) payload to
 * tell a keyframe from a delta frame. A trailing byte is chosen over a leading
 * one so the frame still begins with the codec's real header bytes, which the
 * packetizer depends on.
 */
export async function encryptFrameData(
  key: CryptoKey,
  headerBytes: number,
  data: ArrayBuffer,
): Promise<ArrayBuffer> {
  const input = new Uint8Array(data);
  const clampedHeader = Math.min(headerBytes, input.length);
  const header = input.subarray(0, clampedHeader);
  const payload = input.subarray(clampedHeader);

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload as BufferSource),
  );

  const out = new Uint8Array(clampedHeader + IV_BYTES + cipher.length + 1);
  out.set(header, 0);
  out.set(iv, clampedHeader);
  out.set(cipher, clampedHeader + IV_BYTES);
  out[out.length - 1] = clampedHeader;
  return out.buffer;
}

/** Reverse {@link encryptFrameData}. The offset is read from the trailing byte. */
export async function decryptFrameData(
  key: CryptoKey,
  data: ArrayBuffer,
): Promise<ArrayBuffer> {
  const input = new Uint8Array(data);
  const clampedHeader = input[input.length - 1] ?? 0;
  const header = input.subarray(0, clampedHeader);
  const iv = input.subarray(clampedHeader, clampedHeader + IV_BYTES);
  const cipher = input.subarray(clampedHeader + IV_BYTES, input.length - 1);

  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher as BufferSource),
  );

  const out = new Uint8Array(clampedHeader + plain.length);
  out.set(header, 0);
  out.set(plain, clampedHeader);
  return out.buffer;
}

type Operation = "encrypt" | "decrypt";

interface TransformOptions {
  operation: Operation;
  keyBytes: Uint8Array;
  unencryptedHeaderBytes: UnencryptedHeaderBytes;
}

// The worker body is a fully self-contained string: it must not reference any
// module-scope binding, because bundlers rename/hoist exports and drop unused
// module constants, which would leave dangling references inside the blob (the
// `importKeyFromBytes is not defined` class of runtime error). The crypto here
// mirrors the exported helpers above, which the unit tests cover.
function buildWorkerSource(): string {
  return `
"use strict";

const IV_BYTES = 12;

function importKeyFromBytes(keyBytes) {
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptFrameData(key, headerBytes, data) {
  const input = new Uint8Array(data);
  const clampedHeader = Math.min(headerBytes, input.length);
  const header = input.subarray(0, clampedHeader);
  const payload = input.subarray(clampedHeader);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload));
  const out = new Uint8Array(clampedHeader + IV_BYTES + cipher.length + 1);
  out.set(header, 0);
  out.set(iv, clampedHeader);
  out.set(cipher, clampedHeader + IV_BYTES);
  out[out.length - 1] = clampedHeader;
  return out.buffer;
}

async function decryptFrameData(key, data) {
  const input = new Uint8Array(data);
  const clampedHeader = input[input.length - 1] ?? 0;
  const header = input.subarray(0, clampedHeader);
  const iv = input.subarray(clampedHeader, clampedHeader + IV_BYTES);
  const cipher = input.subarray(clampedHeader + IV_BYTES, input.length - 1);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher));
  const out = new Uint8Array(clampedHeader + plain.length);
  out.set(header, 0);
  out.set(plain, clampedHeader);
  return out.buffer;
}

function makeFrameTransform(options) {
  const keyPromise = importKeyFromBytes(options.keyBytes);
  const header = options.unencryptedHeaderBytes;
  const op = options.operation;
  return new TransformStream({
    async transform(frame, controller) {
      try {
        const key = await keyPromise;
        // Encrypt uses the frame type (the sender knows it); decrypt is
        // self-describing via the trailing length byte, because the receiver
        // cannot read the encrypted payload to classify the frame.
        const bytes = header[frame.type] ?? header.other;
        frame.data = op === "encrypt"
          ? await encryptFrameData(key, bytes, frame.data)
          : await decryptFrameData(key, frame.data);
        controller.enqueue(frame);
      } catch (e) {
        // A frame we cannot (de)crypt is dropped rather than forwarded in the
        // clear or as garbage.
      }
    },
  });
}

self.onrtctransform = (event) => {
  const t = event.transformer;
  t.readable.pipeThrough(makeFrameTransform(t.options)).pipeTo(t.writable);
};
`;
}

/**
 * Installs media encryption on a peer connection's senders and receivers.
 * Create one per {@link Participant} session and reuse it for every track.
 */
export interface E2EEContext {
  applyToSender(sender: RTCRtpSender): void;
  applyToReceiver(receiver: RTCRtpReceiver): void;
  close(): void;
}

/**
 * True when the runtime can encrypt media at all — it needs either
 * `RTCRtpScriptTransform` (Safari, recent Chrome/Firefox) or the legacy
 * `createEncodedStreams` (older Chrome). Call before {@link Participant.enableEncryption}.
 */
export function isE2EESupported(): boolean {
  const sender = (globalThis as any).RTCRtpSender;
  if (typeof sender === "undefined") return false;
  const hasScriptTransform = typeof (globalThis as any).RTCRtpScriptTransform !== "undefined";
  const hasEncodedStreams = typeof sender.prototype?.createEncodedStreams === "function";
  return hasScriptTransform || hasEncodedStreams;
}

export function createE2EEContext(
  keyBytes: Uint8Array,
  options: { unencryptedHeaderBytes?: Partial<UnencryptedHeaderBytes> } = {},
): E2EEContext {
  const unencryptedHeaderBytes: UnencryptedHeaderBytes = {
    ...DEFAULT_UNENCRYPTED_HEADER_BYTES,
    ...options.unencryptedHeaderBytes,
  };

  const ScriptTransform = (globalThis as any).RTCRtpScriptTransform as
    | (new (worker: Worker, options: unknown) => unknown)
    | undefined;

  // Preferred path: one worker shared by every sender/receiver. Each transformer
  // reads its own operation/key from its options, so there is no shared state.
  if (ScriptTransform) {
    const blob = new Blob([buildWorkerSource()], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    const install = (rtp: RTCRtpSender | RTCRtpReceiver, operation: Operation) => {
      const opts: TransformOptions = { operation, keyBytes, unencryptedHeaderBytes };
      (rtp as any).transform = new ScriptTransform(worker, opts);
    };

    return {
      applyToSender: (sender) => install(sender, "encrypt"),
      applyToReceiver: (receiver) => install(receiver, "decrypt"),
      close: () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      },
    };
  }

  // Legacy Chrome fallback: pipe the encoded streams through a main-thread
  // TransformStream. Functionally identical, without the worker isolation.
  const keyPromise = importKeyFromBytes(keyBytes);
  const pipe = (rtp: RTCRtpSender | RTCRtpReceiver, operation: Operation) => {
    const streams = (rtp as any).createEncodedStreams?.();
    if (!streams) return;
    const transform = new TransformStream({
      async transform(frame: any, controller: TransformStreamDefaultController) {
        try {
          const key = await keyPromise;
          const bytes =
            unencryptedHeaderBytes[frame.type as FrameKind] ?? unencryptedHeaderBytes.other;
          frame.data =
            operation === "encrypt"
              ? await encryptFrameData(key, bytes, frame.data)
              : await decryptFrameData(key, frame.data);
          controller.enqueue(frame);
        } catch {
          // drop
        }
      },
    });
    streams.readable.pipeThrough(transform).pipeTo(streams.writable);
  };

  return {
    applyToSender: (sender) => pipe(sender, "encrypt"),
    applyToReceiver: (receiver) => pipe(receiver, "decrypt"),
    close: () => {},
  };
}
