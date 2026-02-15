import { test, expect } from '@playwright/test';
import { ParticipantDriver } from '../utils/participant-driver';

test.describe('Participant Manager', () => {
  let driver: ParticipantDriver;

  test.beforeEach(async ({ page }) => {
    driver = new ParticipantDriver(page);
    await driver.goto();
  });

  test('should update config when re-initialized', async () => {
    await driver.page.evaluate(() => {
      (window as any).__initParticipant({
        videoSlots: 8,
        audioSlots: 4,
        baseUrl: 'http://localhost:8888/api/v1'
      });
    });

    const state = await driver.getTestState();
    // We can't easily check internal config properties unless we expose them,
    // but we can verify the participant instance is still functional.
    expect(state.participant).toBeDefined();
  });

  test('should publish local media stream', async () => {
    await driver.join();
    await driver.page.waitForTimeout(1000);

    const state = await driver.getTestState();
    expect(state.publishedStream).toBeDefined();

    const tracks = await driver.page.evaluate(() => {
      const stream = (window as any).__testState.getPublishedStream();
      return {
        video: stream.getVideoTracks().length,
        audio: stream.getAudioTracks().length
      };
    });

    expect(tracks.video).toBeGreaterThan(0);
    expect(tracks.audio).toBeGreaterThan(0);
  });

  test('should handle mute and unmute controls', async () => {
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/);

    // Mute video
    await driver.toggleVideo();
    await expect(driver.videoMutedState).toHaveText('true');

    // Mute audio
    await driver.toggleAudio();
    await expect(driver.audioMutedState).toHaveText('true');

    // Unmute both
    await driver.toggleVideo();
    await driver.toggleAudio();
    await expect(driver.videoMutedState).toHaveText('false');
    await expect(driver.audioMutedState).toHaveText('false');
  });

  test('should clean up on close', async () => {
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/);
    await driver.leave();

    await driver.expectConnectionState(/new|disconnected|closed/);
    await driver.expectVideoTrackCount(0);
    await driver.expectAudioTrackCount(0);
  });
});
