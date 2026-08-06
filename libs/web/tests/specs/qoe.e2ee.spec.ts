import { test, expect } from '../fixtures';
import type { SdkDriver } from '../utils/participant-driver';
import { waitFor } from '../utils/wait';
import { expectConnected } from '../utils/matchers';
import { maxInboundFps, totalPliCount } from '../utils/qoe';

/**
 * End-to-end media encryption via encoded transforms.
 *
 * Both peers configure the SAME raw AES-GCM key, so the encoded transform
 * encrypts on the publisher and decrypts on the subscriber inside a real browser.
 *
 * What is proven here, and what is not (verified against a local DD-native SFU):
 *  - The encrypt transform loads and runs, and the publisher keeps sending.
 *  - The DD-native SFU forwards the *opaque* stream to a subscriber — packets
 *    arrive. An SFU that inspects the bitstream cannot (it never finds a keyframe
 *    in the ciphertext), so this is gated behind SFU_HAS_DD_NATIVE.
 *  - Full H.264 decode does NOT yet work: encrypting the payload breaks
 *    libwebrtc's packetize→depacketize round-trip, so decode fps collapses to
 *    ~1 and PLIs storm. That is captured by a running `test.fail` guard below,
 *    so the regression is reproduced every CI run (and auto-flags when fixed);
 *    the fix is NAL-aware encryption or a generically-packetized codec.
 */

// Fixed key, passed as a plain array so it survives page.evaluate; the test-app
// coerces it back to Uint8Array.
const KEY = Array.from({ length: 16 }, (_, i) => (i * 17 + 3) & 0xff);

// Default on: assume the SFU under test forwards on the Dependency Descriptor.
// Set SFU_HAS_DD_NATIVE=0 for a legacy (bitstream-inspecting) SFU image.
const DD_NATIVE_SFU = process.env.SFU_HAS_DD_NATIVE !== '0';

async function firstDiscoveredPublisher(sub: SdkDriver): Promise<string> {
  let participantId = '';
  await waitFor(
    async () => (await sub.getState()).videoTracks,
    (tracks) => {
      const t = tracks[0];
      if (t) participantId = t.participantId;
      return !!t;
    },
    { timeout: 20_000, message: 'subscriber never discovered the publisher track' },
  );
  return participantId;
}

test.describe('QoE — E2EE encoded transforms', () => {
  test('the encrypt transform runs and the publisher still sends video', async ({ createSdk, roomId }) => {
    // If the transform worker fails to load (e.g. a dangling reference in its blob
    // source), every frame is dropped and outbound video stays at zero. Asserting
    // the publisher keeps sending is the regression guard for that whole class of
    // bug, and needs no DD-aware SFU — it only measures the publisher's own egress.
    const publisher = await createSdk();
    const subscriber = await createSdk();

    await publisher.create({ encryptionKey: KEY });
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    await subscriber.create({ encryptionKey: KEY });
    await subscriber.connect(roomId);
    const publisherId = await firstDiscoveredPublisher(subscriber);
    await subscriber.subscribe(publisherId, { height: 720 });

    await expect
      .poll(
        async () => {
          const s = await publisher.getStats();
          return s.outboundVideo.reduce((acc, v) => acc + v.bytesSent, 0);
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
  });

  test('the DD-native SFU forwards the encrypted (opaque) stream to a subscriber', async ({ createSdk, roomId }) => {
    test.skip(
      !DD_NATIVE_SFU,
      'requires an SFU that forwards on the Dependency Descriptor (pulsebeam ' +
        'feat/dd-native). A bitstream-inspecting SFU never finds a keyframe in the ' +
        'ciphertext and forwards nothing. Run with SFU_HAS_DD_NATIVE=0 to skip.',
    );

    const publisher = await createSdk();
    const subscriber = await createSdk();

    await publisher.create({ encryptionKey: KEY });
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    await subscriber.create({ encryptionKey: KEY });
    await subscriber.connect(roomId);
    const publisherId = await firstDiscoveredPublisher(subscriber);
    const matched = await subscriber.subscribe(publisherId, { height: 720 });
    expect(matched).toBeGreaterThan(0);

    // The payload is opaque, so the SFU can only forward this by reading keyframes
    // from the Dependency Descriptor. Bytes arriving prove that path works.
    await expect
      .poll(async () => {
        const s = await subscriber.getStats();
        return s.inboundVideo.reduce((acc, v) => acc + v.bytesReceived, 0);
      }, { timeout: 20_000 })
      .toBeGreaterThan(0);
  });

  // KNOWN-FAILING GUARD for the browser E2EE bug users hit: with encryption on,
  // the subscriber's decode frame rate collapses toward ~1fps and the publisher is
  // hammered with PLIs. Root cause: encrypting the H.264 payload breaks libwebrtc's
  // packetize→depacketize round-trip (framesReceived stays ~0), so the decoder
  // keeps demanding keyframes. This test asserts the *correct* behaviour (healthy
  // fps, no PLI storm) and is marked `test.fail`, so it RUNS and reproduces the bug
  // on every CI run without turning the lane red. Fixing it needs NAL-aware
  // encryption (encrypt each NAL's RBSP, preserve start codes, emulation-prevent
  // the ciphertext) or a generically-packetized codec (AV1/VP9). When that lands,
  // this starts passing and Playwright flags the stale `test.fail` to remove.
  test.fail('a subscriber sharing the key decodes encrypted video without an fps collapse or PLI storm', async ({ createSdk, roomId }) => {
    test.skip(
      !DD_NATIVE_SFU,
      'needs a DD-native SFU to forward the opaque stream at all (SFU_HAS_DD_NATIVE=0 to skip)',
    );

    const publisher = await createSdk();
    const subscriber = await createSdk();

    await publisher.create({ encryptionKey: KEY });
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    await subscriber.create({ encryptionKey: KEY });
    await subscriber.connect(roomId);
    const publisherId = await firstDiscoveredPublisher(subscriber);
    await subscriber.subscribe(publisherId, { height: 720 });

    // Let the stream run so decode fps and PLI counts stabilize.
    const pliBefore = totalPliCount(await publisher.getStats());
    await new Promise((r) => setTimeout(r, 10_000));

    const sub = await subscriber.getStats();
    const pub = await publisher.getStats();
    const pliDelta = totalPliCount(pub) - pliBefore;

    // Desired behaviour — both assertions fail today (that's the tracked bug):
    expect(maxInboundFps(sub), 'decode frame rate holds (no collapse to ~1fps)').toBeGreaterThan(10);
    expect(pliDelta, 'no PLI storm (downstream decodes without begging for keyframes)').toBeLessThan(15);
  });

  // PROOF that E2EE is codec-agnostic: point the SFU at a VP9-only build
  // (E2EE_DECODES=1) and the same key-sharing subscriber decodes cleanly.
  // VP9's libwebrtc receive path assembles frames from the Dependency
  // Descriptor, never the payload, so encryption is transparent — frames
  // assemble, fps holds, and no PLI storm. This is the direct counter-proof
  // to the H.264 `test.fail` above: nothing in the SFU or the transform
  // changed, only the codec whose receiver reads the DD.
  test('a key-sharing subscriber decodes encrypted VP9 cleanly (DD-based assembly makes E2EE codec-agnostic)', async ({ createSdk, roomId }) => {
    test.skip(
      process.env.E2EE_DECODES !== '1',
      'needs a DD-assembling codec build (e.g. VP9-only SFU): run with E2EE_DECODES=1',
    );

    const publisher = await createSdk();
    const subscriber = await createSdk();

    await publisher.create({ encryptionKey: KEY });
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    await subscriber.create({ encryptionKey: KEY });
    await subscriber.connect(roomId);
    const publisherId = await firstDiscoveredPublisher(subscriber);
    await subscriber.subscribe(publisherId, { height: 720 });

    const pliBefore = totalPliCount(await publisher.getStats());
    await new Promise((r) => setTimeout(r, 10_000));

    const raw = await subscriber.getRawInboundVideo();
    const sub = await subscriber.getStats();
    const pub = await publisher.getStats();
    const framesReceived = raw.reduce((acc, v) => acc + (v.framesReceived ?? 0), 0);
    const pliDelta = totalPliCount(pub) - pliBefore;

    console.log(
      `[VP9-E2EE-PROOF] framesReceived=${framesReceived} maxFps=${maxInboundFps(sub)} pliDelta=${pliDelta}`,
    );

    expect(framesReceived, 'encrypted frames assemble from the DD (H.264 stalls at ~0)').toBeGreaterThan(30);
    expect(maxInboundFps(sub), 'decode frame rate holds (no collapse to ~1fps)').toBeGreaterThan(10);
    expect(pliDelta, 'no PLI storm (downstream decodes without begging for keyframes)').toBeLessThan(15);
  });
});
