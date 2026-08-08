import { test, expect } from '../fixtures';
import { expectConnected } from '../utils/matchers';

/**
 * Dependency Descriptor negotiation — the CLIENT half of the DD contract.
 *
 * Everything else that depends on DD (E2EE forwarding, temporal-layer shedding)
 * asserts on media flow, which means a client-side regression and a server-side
 * one produce the identical symptom: zero bytes after a 20s poll. This spec pins
 * down the client half on its own, from the SDP, in about a second:
 *
 *  - the DD header extension is offered and kept in the answer, and
 *  - the encoder is negotiated with temporal scalability (L1T{n}), which is what
 *    makes libwebrtc attach a DD to H.264 in the first place.
 *
 * If this fails, the bug is in this repo (transceiver setup in
 * libs/core/src/participant.ts, or the preset's temporalLayers) — not the SFU.
 * If this passes but qoe.e2ee's forwarding test fails, the SFU is the suspect.
 */

// The DD extension is defined by the AV1 RTP spec and reused for other codecs;
// this exact URI is what Chrome puts in the extmap.
const DD_URI =
  'https://aomediacodec.github.io/av1-rtp-spec/#dependency-descriptor-rtp-header-extension';

test.describe('QoE — Dependency Descriptor negotiation', () => {
  test('the publisher negotiates the DD header extension for video', async ({ createSdk, roomId }) => {
    const publisher = await createSdk();

    await publisher.create();
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    const { local, remote } = await publisher.getSdp();

    expect(
      local,
      'Chrome did not OFFER the Dependency Descriptor. libwebrtc only attaches a DD ' +
        'when the encoder runs with temporal scalability — check scalabilityMode on ' +
        'the sendEncodings in libs/core/src/participant.ts.',
    ).toContain(DD_URI);

    expect(
      remote,
      'the SFU did not ACCEPT the Dependency Descriptor extension. Without it the ' +
        'server cannot forward on the DD, which breaks E2EE forwarding and temporal ' +
        'layer shedding — the pinned SFU build is likely not DD-native.',
    ).toContain(DD_URI);
  });

  test('video is negotiated with temporal scalability so a DD is produced', async ({ createSdk, roomId }) => {
    const publisher = await createSdk();

    await publisher.create();
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    // Read back what the browser actually applied — the preset asks for L1T{n} at
    // negotiation time, but Chrome may reject a later setParameters retune and keep
    // the negotiated mode (participant.ts only warns).
    const encodings = await publisher.getVideoEncodings();
    const active = encodings.filter((e) => e.active);

    expect(active.length, 'no active video send encodings found').toBeGreaterThan(0);
    for (const enc of active) {
      expect(
        enc.scalabilityMode,
        `active encoding rid=${enc.rid} must run temporal scalability (L1T2/L1T3); ` +
          'L1T1 or undefined means libwebrtc attaches no Dependency Descriptor',
      ).toMatch(/^L1T[23]$/);
    }
  });
});
