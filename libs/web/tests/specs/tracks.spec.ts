import { test, expect, TEST_TIMEOUTS } from '../fixtures';
import fc from 'fast-check';

const JOIN_TIMEOUT = TEST_TIMEOUTS.CONNECTION;

test.describe('Track Management', () => {
  test('tracks appear on join and reset on leave', async ({ driver, createDriver }) => {
    const roomId = `tracks-test-${Math.random().toString(36).substring(7)}`;

    // Create a second participant to publish media
    const driver2 = await createDriver();
    await driver2.setRoomId(roomId);
    await driver2.join();
    await driver2.waitForConnectionState(/connected/);

    await driver.setRoomId(roomId);
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/, JOIN_TIMEOUT);

    await expect(driver.videoGrid).toBeVisible();
    await expect
      .poll(async () => driver.getVideoTrackCount(), { timeout: TEST_TIMEOUTS.MEDIA_READY })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => driver.getAudioTrackCount(), { timeout: TEST_TIMEOUTS.MEDIA_READY })
      .toBeGreaterThan(0);

    await driver.leave();
    await expect(driver.joinButton).toBeVisible({ timeout: JOIN_TIMEOUT });
    await driver.expectVideoTrackCount(0);
    await driver.expectAudioTrackCount(0);
  });

  test('multiple join/leave cycles keep track counts sane', async ({ createDriver }) => {
    const roomId = `tracks-cycle-${Math.random().toString(36).substring(7)}`;

    // Remote publisher
    const driver2 = await createDriver();
    await driver2.setRoomId(roomId);
    await driver2.join();
    await driver2.waitForConnectionState(/connected/);

    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async cycles => {
        const driver = await createDriver();
        await driver.setRoomId(roomId);

        for (let i = 0; i < cycles; i += 1) {
          await driver.join();
          await driver.waitForConnectionState(/connecting|connected|failed/, JOIN_TIMEOUT);
          await expect
            .poll(async () => driver.getVideoTrackCount(), { timeout: TEST_TIMEOUTS.MEDIA_READY })
            .toBeGreaterThan(0);
          await expect
            .poll(async () => driver.getAudioTrackCount(), { timeout: TEST_TIMEOUTS.MEDIA_READY })
            .toBeGreaterThan(0);

          await driver.leave();
          await expect(driver.joinButton).toBeVisible({ timeout: JOIN_TIMEOUT });
          await driver.expectVideoTrackCount(0);
          await driver.expectAudioTrackCount(0);
        }
      }),
      { numRuns: 2 }
    );
  });
});
