import { test } from '../fixtures';
import type { SdkDriver } from '../utils/participant-driver';
import { waitFor } from '../utils/wait';
import { expectReceivingVideo, expectConnected, expectStreamRecovers } from '../utils/matchers';

/**
 * Reconnect / churn recovery QoE. Uses Playwright's per-context `setOffline`
 * (deterministic, unprivileged) — NOT `netem` — so it belongs in the blocking
 * lane. Asserts media resumes ABOVE a pre-disruption baseline, the robust analog
 * of the sim's partition→repair→`CheckVideoQuality` scenario.
 */

async function joinPubSub(createSdk: () => Promise<SdkDriver>, roomId: string) {
  const publisher = await createSdk();
  const subscriber = await createSdk();

  await publisher.create();
  await publisher.publish({ video: true, audio: true });
  await publisher.connect(roomId);

  await subscriber.create();
  await subscriber.connect(roomId);
  await expectConnected(subscriber);

  let publisherId = '';
  await waitFor(
    async () => (await subscriber.getState()).videoTracks,
    (tracks) => { if (tracks[0]) publisherId = tracks[0].participantId; return !!tracks[0]; },
    { timeout: 20_000, message: 'subscriber never discovered the publisher' },
  );
  await subscriber.subscribe(publisherId, { height: 720 });
  await expectReceivingVideo(subscriber, { minFramesDelta: 15 });

  return { publisher, subscriber };
}

test.describe('QoE — reconnect recovery', () => {
  // @flaky: tearing down an established WebRTC media path needs real network fault
  // injection (netem). Playwright's context.setOffline() only blocks the browser's
  // HTTP stack, not the UDP media transport, so it cannot reliably drop the PC.
  // Quarantined to the non-blocking lane and skipped where netem isn't available.
  test('subscriber video recovers after a network drop @flaky', async ({ createSdk, roomId, network }) => {
    test.skip(!network.isFunctional, 'netem (sudo tc) not available; cannot drop the WebRTC media path');
    const { subscriber } = await joinPubSub(createSdk, roomId);

    await expectStreamRecovers(
      subscriber,
      async () => {
        // Actually cut the media path, wait for the SDK to notice, then restore —
        // the SDK should auto-reconnect (PATCH + fresh transport) and media resume.
        await network.shutdown();
        await waitFor(
          async () => (await subscriber.getState()).connectionState,
          (s) => s === 'disconnected' || s === 'failed' || s === 'connecting',
          { timeout: 25_000, message: 'connection never dropped after netem shutdown' },
        );
        await network.reset();
      },
      { minFramesDelta: 15, timeout: 45_000 },
    );
  });

  test('remaining participant keeps receiving when a publisher rejoins', async ({ createSdk, roomId }) => {
    const { publisher, subscriber } = await joinPubSub(createSdk, roomId);

    // Publisher leaves, then a fresh publisher rejoins the same room.
    await publisher.close();
    const publisher2 = await createSdk();
    await publisher2.create();
    await publisher2.publish({ video: true, audio: true });
    await publisher2.connect(roomId);

    let newPublisherId = '';
    await waitFor(
      async () => (await subscriber.getState()).videoTracks,
      (tracks) => {
        const t = tracks.find((x) => !x.paused) ?? tracks[0];
        if (t) newPublisherId = t.participantId;
        return tracks.length > 0;
      },
      { timeout: 25_000, message: 'subscriber never rediscovered a publisher after churn' },
    );
    await subscriber.subscribe(newPublisherId, { height: 720 });
    await expectReceivingVideo(subscriber, { minFramesDelta: 15, timeout: 30_000 });
  });
});
