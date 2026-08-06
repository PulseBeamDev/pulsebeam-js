import { describe, expect, it } from "vitest";
import {
  DEFAULT_UNENCRYPTED_HEADER_BYTES,
  decryptFrameData,
  encryptFrameData,
  importKeyFromBytes,
} from "../src/e2ee";

const KEY = new Uint8Array(16).fill(7);

function frame(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("encoded-transform E2EE crypto", () => {
  it("round-trips a frame through encrypt/decrypt with the same key", async () => {
    const key = await importKeyFromBytes(KEY);
    const original = frame([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const sealed = await encryptFrameData(key, 3, original.slice(0));
    const opened = await decryptFrameData(key, sealed);

    expect(new Uint8Array(opened)).toEqual(new Uint8Array(original));
  });

  it("decrypts without being told the offset (self-describing trailing byte)", async () => {
    const key = await importKeyFromBytes(KEY);
    const original = frame([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 11, 12, 13]);

    // Encrypted with a 10-byte header; decrypt is given no offset and must
    // recover it from the frame itself — the receiver cannot know frame.type.
    const sealed = await encryptFrameData(key, 10, original.slice(0));
    const opened = await decryptFrameData(key, sealed);

    expect(new Uint8Array(opened)).toEqual(new Uint8Array(original));
  });

  it("leaves the unencrypted header in the clear but hides the payload", async () => {
    const key = await importKeyFromBytes(KEY);
    const header = DEFAULT_UNENCRYPTED_HEADER_BYTES.delta; // 3
    const original = new Uint8Array([10, 20, 30, 99, 98, 97, 96]);

    const sealed = new Uint8Array(await encryptFrameData(key, header, original.buffer.slice(0)));

    // Header bytes survive verbatim at the front.
    expect(Array.from(sealed.subarray(0, header))).toEqual([10, 20, 30]);
    // The payload region (between header and the trailing length byte) is not
    // the plaintext payload.
    const plainPayload = [99, 98, 97, 96];
    expect(Array.from(sealed.subarray(header, sealed.length - 1))).not.toEqual(plainPayload);
    // Grew by the IV (12), the GCM tag (16), and the trailing length byte (1).
    expect(sealed.length).toBe(original.length + 12 + 16 + 1);
    // The trailing byte records the header length so decrypt is self-describing.
    expect(sealed[sealed.length - 1]).toBe(header);
  });

  it("fails to decrypt with the wrong key (no silent plaintext leak)", async () => {
    const key = await importKeyFromBytes(KEY);
    const wrong = await importKeyFromBytes(new Uint8Array(16).fill(9));
    const sealed = await encryptFrameData(key, 1, frame([1, 2, 3, 4, 5]));

    await expect(decryptFrameData(wrong, sealed)).rejects.toThrow();
  });

  it("uses a fresh IV per frame so identical plaintext yields different ciphertext", async () => {
    const key = await importKeyFromBytes(KEY);
    const a = new Uint8Array(await encryptFrameData(key, 1, frame([5, 5, 5, 5])));
    const b = new Uint8Array(await encryptFrameData(key, 1, frame([5, 5, 5, 5])));

    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});
