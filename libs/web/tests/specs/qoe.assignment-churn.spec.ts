import { test, expect } from '../fixtures';
import type { SdkDriver } from '../utils/participant-driver';
import { expectConnected, expectReceivingVideo } from '../utils/matchers';

async function expectBinding(
  driver: SdkDriver,
  participantId: string,
  expected: { paused: boolean; streamTracks: number },
) {
  await expect
    .poll(
      async () => {
        const binding = (await driver.getVideoBindings()).find(
          (track) => track.participantId === participantId,
        );
        return binding && {
          paused: binding.paused,
          streamTracks: binding.streamTracks,
        };
      },
      { timeout: 25_000 },
    )
    .toEqual(expected);
}

function participantKey(id: string) {
  return id.split('?')[0];
}

async function waitForRemoteTrack(driver: SdkDriver, participantId: string) {
  let remoteTrackId = '';
  await expect
    .poll(
      async () => {
        const track = (await driver.getState()).videoTracks.find(
          (candidate) => participantKey(candidate.participantId) === participantKey(participantId),
        );
        if (track) remoteTrackId = track.participantId;
        return !!track;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  return remoteTrackId;
}

test.describe('QoE — receive assignment churn', () => {
  test('a one-slot receiver binds the replacement track after its current publisher leaves', async ({
    createSdk,
    roomId,
  }) => {
    const firstPublisher = await createSdk();
    const secondPublisher = await createSdk();
    const warmupSubscriber = await createSdk();
    const subscriber = await createSdk();

    await firstPublisher.create();
    await firstPublisher.publish({ video: true, audio: false });
    await firstPublisher.connect(roomId);
    await expectConnected(firstPublisher);

    await secondPublisher.create();
    await secondPublisher.publish({ video: true, audio: false });
    await secondPublisher.connect(roomId);
    await expectConnected(secondPublisher);

    const firstId = (await firstPublisher.getState()).participantId;
    const secondId = (await secondPublisher.getState()).participantId;
    if (!firstId || !secondId) throw new Error('publishers did not receive participant IDs');

    await warmupSubscriber.create({ videoSlots: 2 });
    await warmupSubscriber.connect(roomId);
    await expectConnected(warmupSubscriber);

    const firstWarmupTrackId = await waitForRemoteTrack(warmupSubscriber, firstId);
    const secondWarmupTrackId = await waitForRemoteTrack(warmupSubscriber, secondId);
    expect(await warmupSubscriber.subscribe(firstWarmupTrackId, { height: 720 })).toBe(1);
    expect(await warmupSubscriber.subscribe(secondWarmupTrackId, { height: 720 })).toBe(1);
    await expectReceivingVideo(warmupSubscriber, { minFramesDelta: 10 });

    await subscriber.create({ videoSlots: 1 });
    await subscriber.connect(roomId);
    await expectConnected(subscriber);

    if (!firstId || !secondId) throw new Error('publishers did not receive participant IDs');

    await expect
      .poll(
        async () => {
          return (await subscriber.getState()).videoTracks.length;
        },
        { timeout: 20_000 },
      )
      .toBe(2);

    const remoteTracks = (await subscriber.getState()).videoTracks;
    const firstRemoteId = remoteTracks.find(
      (track) => participantKey(track.participantId) === participantKey(firstId),
    )?.participantId;
    const secondRemoteId = remoteTracks.find(
      (track) => participantKey(track.participantId) === participantKey(secondId),
    )?.participantId;
    if (!firstRemoteId || !secondRemoteId) {
      throw new Error(`subscriber discovered unexpected publishers: ${JSON.stringify(remoteTracks)}`);
    }

    expect(await subscriber.subscribe(firstRemoteId, { height: 720, priority: 100 })).toBe(1);
    expect(await subscriber.subscribe(secondRemoteId, { height: 720, priority: 10 })).toBe(1);
    await expectBinding(subscriber, firstRemoteId, { paused: false, streamTracks: 1 });

    await firstPublisher.close();

    await expect
      .poll(
        async () => {
          const tracks = (await subscriber.getState()).videoTracks;
          return tracks.some((track) => track.participantId === firstRemoteId);
        },
        { timeout: 20_000 },
      )
      .toBe(false);

    await expectBinding(subscriber, secondRemoteId, { paused: false, streamTracks: 1 });
  });
});
