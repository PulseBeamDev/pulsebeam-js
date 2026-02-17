import { test, expect, TEST_TIMEOUTS } from '../fixtures';

const JOIN_TIMEOUT = TEST_TIMEOUTS.CONNECTION;

test.describe('Display Manager', () => {
  test('screen share capability is available', async ({ driver }) => {
    const hasScreenShare = await driver.page.evaluate(() => {
      return !!navigator.mediaDevices.getDisplayMedia;
    });
    expect(hasScreenShare).toBe(true);
  });

  test('screen share click keeps UI responsive', async ({ driver, page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/, JOIN_TIMEOUT);
    await expect(driver.shareScreenButton).toBeVisible();

    await driver.shareScreen();
    await expect(driver.connectionState).toHaveText(/connecting|connected|failed/);
    await expect(driver.toggleVideoButton).toBeVisible();
    await expect(driver.toggleAudioButton).toBeVisible();

    expect(pageErrors).toHaveLength(0);
  });
});
