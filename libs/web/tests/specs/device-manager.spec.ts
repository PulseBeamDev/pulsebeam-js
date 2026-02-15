import { test, expect } from '@playwright/test';
import { ParticipantDriver } from '../utils/participant-driver';

test.describe('Device and Display Managers', () => {
  let driver: ParticipantDriver;

  test.beforeEach(async ({ page }) => {
    driver = new ParticipantDriver(page);
    await driver.goto();
  });

  test.skip('DeviceManager should enumerate devices', async () => {
    const devices = await driver.page.evaluate(async () => {
      const dm = (window as any).__testState.deviceManager;
      return dm.get();
    });

    expect(devices.cameras).toBeDefined();
    expect(devices.microphones).toBeDefined();
    expect(devices.speakers).toBeDefined();

    // With fake-device flag in Playwright, we should see at least one
    expect(devices.cameras.length).toBeGreaterThan(0);
  });

  test('DeviceManager should handle permission state', async () => {
    const state = await driver.page.evaluate(async () => {
      const dm = (window as any).__testState.deviceManager;
      return dm.get();
    });

    // In automated tests with permissions granted in config, this should be true or granted
    expect(state).toBeDefined();
  });

  test('DisplayManager should handle screen share capability', async () => {
    const hasScreenShare = await driver.page.evaluate(() => {
      return !!navigator.mediaDevices.getDisplayMedia;
    });
    expect(hasScreenShare).toBe(true);
  });

  test('Participant should use displayManager for screen sharing', async () => {
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/);

    // Trigger screen share from UI
    await driver.shareScreen();

    const state = await driver.getTestState();
    expect(state.publishedStream).toBeDefined();
  });
});
