import { test } from '../fixtures';
import type { SdkDriver } from '../utils/participant-driver';
import { waitFor } from '../utils/wait';
import { expectReceivingVideo, expectSmoothVideo, expectConnected } from '../utils/matchers';

/**
 * Freeze QA — the property users actually feel. libwebrtc reports a freeze when
 * an inter-frame gap runs long (~max(3×avg, avg+150ms)), so `freezeCount` and
 * `totalFreezesDuration` are the direct measure of "the video froze." These
 * scenarios assert the stream stays smooth through the operations most likely to
 * stall it: simulcast layer switches and steady soak. Browser analog of the Rust
 * simulator's no-freeze / EgressGuard checks.
 */

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

test.describe('QoE — freeze budget', () => {
  test('steady-state playback does not freeze', async ({ createSdk, roomId }) => {
    const publisher = await createSdk();
    const subscriber = await createSdk();

    await publisher.create();
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    await subscriber.create();
    await subscriber.connect(roomId);
    const publisherId = await firstDiscoveredPublisher(subscriber);
    await subscriber.subscribe(publisherId, { height: 720 });

    await expectReceivingVideo(subscriber, { minFramesDelta: 30, minHeight: 240 });

    // No disruption — just soak and confirm smoothness.
    await expectSmoothVideo(subscriber, async () => { }, {
      window: 8_000,
      maxFreezes: 1,
      maxFreezeSeconds: 1.0,
      minFramesDelta: 120,
    });
  });

  test('simulcast layer switches stay smooth', async ({ createSdk, roomId }) => {
    const publisher = await createSdk();
    const subscriber = await createSdk();

    // Publish all three simulcast layers so there is something to switch between.
    await publisher.create();
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    await subscriber.create();
    await subscriber.connect(roomId);
    const publisherId = await firstDiscoveredPublisher(subscriber);
    await subscriber.subscribe(publisherId, { height: 720 });
    await expectReceivingVideo(subscriber, { minFramesDelta: 30, minHeight: 240 });

    // Drive the switcher: request a low layer, then back up. Each height change
    // makes the SFU switch simulcast encodings — the classic freeze risk.
    await expectSmoothVideo(
      subscriber,
      async () => {
        await subscriber.subscribe(publisherId, { height: 180 });
        await new Promise((r) => setTimeout(r, 2_500));
        await subscriber.subscribe(publisherId, { height: 720 });
      },
      { window: 10_000, maxFreezes: 2, maxFreezeSeconds: 1.5, minFramesDelta: 120 },
    );
  });

  // @flaky: needs real bandwidth throttling (netem). This is the case users hit
  // most — the link narrows and the stream must degrade to a lower layer rather
  // than stall. Quarantined to the non-blocking lane and skipped where tc is
  // unavailable. A well-behaved SFU keeps frames flowing with bounded freezing.
  test('congestion degrades gracefully without stalling @flaky', async ({ createSdk, roomId, network }) => {
    test.skip(!network.isFunctional, 'netem (sudo tc) not available; cannot throttle bandwidth');

    const publisher = await createSdk();
    const subscriber = await createSdk();

    await publisher.create();
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    await subscriber.create();
    await subscriber.connect(roomId);
    const publisherId = await firstDiscoveredPublisher(subscriber);
    await subscriber.subscribe(publisherId, { height: 720 });
    await expectReceivingVideo(subscriber, { minFramesDelta: 30, minHeight: 240 });

    try {
      // Squeeze the link below the top layer's rate: the SFU must switch down,
      // not freeze. Some freezing is expected during adaptation; it must stay
      // bounded and video must keep decoding at the adapted layer.
      await expectSmoothVideo(
        subscriber,
        async () => {
          await network.apply({ rate: '500kbit' });
        },
        { window: 14_000, maxFreezes: 4, maxFreezeSeconds: 3.0, minFramesDelta: 120 },
      );
    } finally {
      await network.reset();
    }
  });
});
