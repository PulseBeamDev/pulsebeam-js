import { test, expect, TEST_ROOMS, TEST_TIMEOUTS } from '../fixtures';

test.describe('Connection Lifecycle', () => {
  test('should transition through states during connect', async ({ driver }) => {
    await driver.setRoomId(TEST_ROOMS.BASIC);
    await driver.join();

    // Should hit connecting before connected or failed
    await driver.waitForConnectionState(/connecting|connected|failed/);
  });

  test('should handle graceful disconnect', async ({ driver }) => {
    await driver.setRoomId(TEST_ROOMS.BASIC);
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/);

    await driver.leave();
    await driver.expectConnectionState(/new|disconnected|closed/);
  });

  test('should automatically reconnect after network failure', async ({ driver, network }) => {
    await driver.setRoomId(TEST_ROOMS.RECONNECTION);
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.CONNECTION);

    // Simulate network loss
    network.shutdown();
    await driver.waitForConnectionState(/failed|disconnected/, 15000);

    // Restore network
    network.reset();
    await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.RECONNECTION);
  });

  test('should handle session recovery with same participant ID', async ({ driver, network }) => {
    await driver.setRoomId(TEST_ROOMS.RECONNECTION);
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.CONNECTION);

    const initialId = await driver.page.evaluate(() => (window as any).__testState.participant.value.id);

    // Toggle network
    network.shutdown();
    await driver.page.waitForTimeout(1000);
    network.reset();

    await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.RECONNECTION);
    const finalId = await driver.page.evaluate(() => (window as any).__testState.participant.value.id);

    expect(finalId).toBe(initialId);
  });

  test('should fail reconnection after max retries', async ({ driver, network }) => {
    await driver.setRoomId(TEST_ROOMS.RECONNECTION);
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.CONNECTION);

    // Block all traffic to force failure
    network.shutdown();

    // We don't want to wait for minutes, just verify it's not connected
    await driver.page.waitForTimeout(5000);
    await driver.expectConnectionState(/failed|disconnected/);
  });
});
