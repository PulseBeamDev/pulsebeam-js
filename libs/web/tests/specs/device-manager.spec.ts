import { test, expect, TEST_TIMEOUTS } from '../fixtures';

const JOIN_TIMEOUT = TEST_TIMEOUTS.CONNECTION;

test.describe('Device and Display Managers', () => {
  test('browser device enumeration is available', async ({ driver }) => {
    const devices = await driver.page.evaluate(async () => {
      const list = await navigator.mediaDevices.enumerateDevices();
      return list.map(d => ({ kind: d.kind, label: d.label }));
    });

    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBeGreaterThan(0);
    expect(devices.some(d => d.kind === 'audioinput' || d.kind === 'videoinput')).toBe(true);
  });

  test('screen share capability is exposed by the browser', async ({ driver }) => {
    const hasScreenShare = await driver.page.evaluate(() => {
      return !!navigator.mediaDevices.getDisplayMedia;
    });
    expect(hasScreenShare).toBe(true);
  });

  test('screen share control appears after join', async ({ driver }) => {
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/, JOIN_TIMEOUT);
    await expect(driver.shareScreenButton).toBeVisible();
  });
});
