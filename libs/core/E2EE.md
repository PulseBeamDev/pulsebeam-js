# End-to-end media encryption

`@pulsebeam/core` can encrypt audio and video **end to end** using WebRTC
Encoded Transforms. Each RTP frame's payload is AES-GCM encrypted on the sender
and decrypted on the receiver, so the SFU only ever forwards **ciphertext** and
holds no key.

This is what the SFU's Dependency-Descriptor-native forwarding is for: once the
payload is opaque, the SFU can no longer read the codec bitstream to find
keyframes or shed temporal layers, so it routes on the **Dependency Descriptor**
— an RTP header extension that the packetizer adds *after* the encrypt transform
runs, and which therefore stays in the clear.

> This is transport-level E2EE (per-frame AES-GCM), **not** full RFC 9605 SFrame.
> There is no built-in key negotiation, ratcheting, or MLS. Distributing and
> rotating the key is the application's responsibility — anyone with the key can
> decrypt.

## Enabling it

Two equivalent ways; both must take effect **before** `connect()`.

Via config (threads through `@pulsebeam/react` unchanged):

```ts
const key = await deriveKey("a shared room passphrase");
const participant = new Participant(adapter, {
  baseUrl, token,
  encryptionKey: key, // 16- or 32-byte AES-GCM key
});
participant.connect(roomId);
```

Or imperatively:

```ts
if (isE2EESupported()) {
  participant.enableEncryption(key);
}
participant.connect(roomId);
```

Deriving a key from a shared secret (so every peer in a room agrees):

```ts
async function deriveKey(passphrase: string): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode("pulsebeam-e2ee"), iterations: 100_000, hash: "SHA-256" },
    material, 256,
  );
  return new Uint8Array(bits);
}
```

## SFU requirement

Encryption makes the payload opaque, so the SFU can no longer find keyframes by
inspecting the bitstream — it must read them from the Dependency Descriptor
(**DD-native forwarding**). An SFU without that path will accept the publisher's
encrypted stream but never forward it to a subscriber, because it never detects a
keyframe to start from. The browser Playwright e2e reflects this: the encrypt
transform is verified unconditionally, but the key-sharing decode round-trip is
gated behind `SFU_HAS_DD_NATIVE=1`.

## Verifying in a browser

1. Open two tabs in the same room with the **same** key. Video decodes in both.
2. Change the key in one tab → that peer's media no longer decodes for the other,
   confirming the SFU cannot substitute or read it.
3. In `chrome://webrtc-internals`, the outbound-rtp still shows
   `scalabilityMode: "L1T3"` and the SDP still negotiates the Dependency
   Descriptor extmap — the SFU keeps shedding frame rate under congestion even
   though it cannot read a single payload byte.

## Status by codec (important)

The transport is proven end-to-end in a real browser (`libs/web` Playwright
`qoe.e2ee` spec) up to a known H.264 limitation:

- The encrypt transform runs and the publisher sends encrypted media. ✅
- A **DD-native SFU forwards the opaque stream** to a subscriber — packets
  arrive. ✅ (A bitstream-inspecting SFU forwards nothing.)
- **H.264 does not yet decode end to end.** Encrypting the payload with the
  current fixed-prefix scheme breaks the H.264 packetize→depacketize round-trip,
  so the receiver reassembles zero frames (`framesReceived == 0`) even though
  packets arrive. Making H.264 decode requires **NAL-aware encryption**: encrypt
  each NAL unit's RBSP, keep the start codes and NAL headers intact, and
  emulation-prevent the ciphertext so it cannot contain a spurious start code.
  VP8/VP9 encoded frames are byte-preserving across packetization and round-trip
  with the current scheme.

`unencryptedHeaderBytes` leaves a small per-frame-type prefix (`{ key, delta,
other }`) in the clear on encrypt; decrypt is self-describing (the header length
is appended as the frame's final byte) because a receiver cannot read the
encrypted payload to classify the frame. Tune the prefix via `encryptionHeaderBytes`
(config) or the second argument to `enableEncryption`.
