import { test, expect } from '../fixtures';
import type { SdkDriver } from '../utils/participant-driver';
import { waitFor } from '../utils/wait';
import { expectReceivingVideo, expectAudioFlowing, expectConnected } from '../utils/matchers';

/**
 * Happy-path QoE: a subscriber actually decodes real video and hears real audio
 * from a publisher. Asserts on `getStats()` (framesDecoded / totalAudioEnergy),
 * not track counts — proving media flows end-to-end, not just that negotiation
 * happened. Browser QoE tier, blocking lane.
 */

/** Wait until `sub` has discovered a remote video track, then return its participantId. */
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

test.describe('QoE — happy path', () => {
  test('subscriber decodes real video and audio from a publisher', async ({ createSdk, roomId }) => {
    const publisher = await createSdk();
    const subscriber = await createSdk();

    // Publisher joins and publishes camera + mic.
    await publisher.create();
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);
    await expectConnected(publisher);

    // Subscriber joins (manual_sub — it must opt in per discovered track).
    await subscriber.create();
    await subscriber.connect(roomId);
    await expectConnected(subscriber);

    const publisherId = await firstDiscoveredPublisher(subscriber);
    const matched = await subscriber.subscribe(publisherId, { height: 720 });
    expect(matched).toBeGreaterThan(0);

    // The actual QoE assertions: real frames decoded, real audio energy.
    await expectReceivingVideo(subscriber, { minFramesDelta: 15, minHeight: 240 });
    await expectAudioFlowing(subscriber);
  });

  test('publisher sends real video upstream', async ({ createSdk, roomId }) => {
    const publisher = await createSdk();
    const subscriber = await createSdk();

    await publisher.create();
    await publisher.publish({ video: true, audio: true });
    await publisher.connect(roomId);

    await subscriber.create();
    await subscriber.connect(roomId);
    const publisherId = await firstDiscoveredPublisher(subscriber);
    await subscriber.subscribe(publisherId, { height: 720 });

    // Outbound video is only produced once someone subscribes (SFU pulls the layer).
    await expect
      .poll(async () => {
        const s = await publisher.getStats();
        return s.outboundVideo.reduce((acc, v) => acc + v.bytesSent, 0);
      }, { timeout: 25_000, intervals: [500, 1000, 2000], message: 'publisher sent no video bytes' })
      .toBeGreaterThan(0);
  });
});
