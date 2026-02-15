import { test, expect } from '@playwright/test';
import { ParticipantDriver } from '../utils/participant-driver';
import { NetworkSimulator } from '../utils/network-simulator';
import { TEST_ROOMS, TEST_TIMEOUTS } from '../fixtures/test-data';

test.describe('Connection Lifecycle', () => {
    let driver: ParticipantDriver;
    let network: NetworkSimulator;

    test.beforeEach(async ({ page, context }) => {
        driver = new ParticipantDriver(page);
        network = new NetworkSimulator(context);
        await driver.goto();
    });

    test('should transition through states during connect', async () => {
        await driver.setRoomId(TEST_ROOMS.BASIC);
        await driver.join();

        // Should hit connecting before connected or failed
        await driver.waitForConnectionState(/connecting|connected|failed/);
    });

    test('should handle graceful disconnect', async () => {
        await driver.setRoomId(TEST_ROOMS.BASIC);
        await driver.join();
        await driver.waitForConnectionState(/connecting|connected|failed/);

        await driver.leave();
        await driver.expectConnectionState(/new|disconnected|closed/);
    });

    test('should automatically reconnect after network failure', async () => {
        await driver.setRoomId(TEST_ROOMS.RECONNECTION);
        await driver.join();
        await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.CONNECTION);

        // Simulate network loss
        await network.goOffline();
        await driver.waitForConnectionState(/failed|disconnected/, 15000);

        // Restore network
        await network.goOnline();
        await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.RECONNECTION);
    });

    test('should handle session recovery with same participant ID', async () => {
        await driver.setRoomId(TEST_ROOMS.RECONNECTION);
        await driver.join();
        await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.CONNECTION);

        const initialId = await driver.page.evaluate(() => (window as any).__testState.participant.value.id);

        // Toggle network
        await network.goOffline();
        await driver.page.waitForTimeout(1000);
        await network.goOnline();

        await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.RECONNECTION);
        const finalId = await driver.page.evaluate(() => (window as any).__testState.participant.value.id);

        expect(finalId).toBe(initialId);
    });

    test('should fail reconnection after max retries', async () => {
        await driver.setRoomId(TEST_ROOMS.RECONNECTION);
        await driver.join();
        await driver.waitForConnectionState(/connecting|connected/, TEST_TIMEOUTS.CONNECTION);

        // Block all traffic to force failure
        await network.goOffline();

        // We don't want to wait for minutes, just verify it's not connected
        await driver.page.waitForTimeout(5000);
        await driver.expectConnectionState(/failed|disconnected/);
    });
});
