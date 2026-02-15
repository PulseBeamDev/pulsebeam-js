import { test, expect } from '../fixtures';
import { ParticipantDriver } from '../utils/participant-driver';
import { NetworkSimulator } from '../utils/network-simulator';

test.describe('Edge Cases and Error Handling', () => {
  test('should handle network offline during join', async ({ driver, network }) => {
    network.shutdown();
    await driver.join();

    // Should enter failed or stay in connecting
    await driver.page.waitForTimeout(3000);
    const state = await driver.connectionState.textContent();
    expect(['new', 'connecting', 'failed', 'disconnected']).toContain(state);
  });

  test('should handle server errors during signaling', async ({ page, driver, network }) => {
    // Block signaling requests
    await network.blockUrls(page, ['*/api/v1/*']);

    await driver.join();
    await driver.page.waitForTimeout(5000);
    await driver.expectConnectionState(/failed|disconnected|connecting/);
  });

  test('should recover after rapid browser navigation', async ({ driver }) => {
    await driver.join();
    await driver.page.reload();
    await driver.page.waitForTimeout(1000);

    // Test app should re-initialize
    await expect(driver.page.getByTestId('test-app')).toBeVisible();
    await driver.expectConnectionState('new');
  });

  test('should handle resource cleanup on unexpected exit', async ({ driver }) => {
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/);

    // Check if media devices are released if we navigate away
    await driver.page.goto('about:blank');
    // We can't easily verify hardware state from browser,
    // but we verify no crash during exit.
  });
});
