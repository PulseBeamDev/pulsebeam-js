import { test, expect } from '@playwright/test';
import { ParticipantDriver } from '../utils/participant-driver';
import { TEST_ROOMS } from '../fixtures/test-data';

test.describe('Track Management', () => {
  let driver: ParticipantDriver;

  test.beforeEach(async ({ page }) => {
    driver = new ParticipantDriver(page);
    await driver.goto();
  });

  test('should handle video track appearance and removal', async () => {
    await driver.setRoomId(TEST_ROOMS.TRACKS);
    await driver.join();

    // In a mock environment, we might need to manually trigger tracks if the mock server doesn't
    // For this test, we verify the UI components for tracks are ready
    await expect(driver.videoGrid).toBeVisible();
    await driver.expectVideoTrackCount(0); // Initially empty

    // We can simulate track arrival by evaluating against the participant store
    await driver.page.evaluate(() => {
      const p = (window as any).__testState.participant;
      const track = {
        id: 'test-video-track',
        kind: 'video',
        participantId: 'peer-1',
        stream: new MediaStream(),
        setHeight: () => { }
      };
      // Mocking internal store update for E2E verification
      p.set({
        ...p.get(),
        videoTracks: [track]
      });
    });

    await driver.expectVideoTrackCount(1);
    await expect(driver.page.locator('[data-track-id="test-video-track"]')).toBeVisible();

    // Remove track
    await driver.page.evaluate(() => {
      const p = (window as any).__testState.participant;
      p.set({
        ...p.get(),
        videoTracks: []
      });
    });

    await driver.expectVideoTrackCount(0);
    await expect(driver.page.locator('[data-track-id="test-video-track"]')).not.toBeVisible();
  });

  test('should handle audio track appearance and removal', async () => {
    await driver.setRoomId(TEST_ROOMS.TRACKS);
    await driver.join();

    await driver.page.evaluate(() => {
      const p = (window as any).__testState.participant;
      const track = {
        id: 'test-audio-track',
        kind: 'audio',
        participantId: 'peer-1',
        stream: new MediaStream(),
      };
      p.set({
        ...p.get(),
        audioTracks: [track]
      });
    });

    await driver.expectAudioTrackCount(1);
    await expect(driver.page.locator('[data-audio-id="test-audio-track"]')).toBeAttached();

    // Remove track
    await driver.page.evaluate(() => {
      const p = (window as any).__testState.participant;
      p.set({
        ...p.get(),
        audioTracks: []
      });
    });

    await driver.expectAudioTrackCount(0);
  });

  test('should manage multiple simultaneous tracks', async () => {
    await driver.setRoomId(TEST_ROOMS.TRACKS);
    await driver.join();

    await driver.page.evaluate(() => {
      const p = (window as any).__testState.participant;
      const videoTracks = [
        { id: 'v1', kind: 'video', participantId: 'p1', stream: new MediaStream(), setHeight: () => { } },
        { id: 'v2', kind: 'video', participantId: 'p2', stream: new MediaStream(), setHeight: () => { } }
      ];
      const audioTracks = [
        { id: 'a1', kind: 'audio', participantId: 'p1', stream: new MediaStream() }
      ];
      p.set({
        ...p.get(),
        videoTracks,
        audioTracks
      });
    });

    await driver.expectVideoTrackCount(2);
    await driver.expectAudioTrackCount(1);
  });
});
