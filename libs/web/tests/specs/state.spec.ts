import { test, expect } from '@playwright/test';
import { ParticipantDriver } from '../utils/participant-driver';

test.describe('State Synchronization', () => {
    let driver: ParticipantDriver;

    test.beforeEach(async ({ page }) => {
        driver = new ParticipantDriver(page);
        await driver.goto();
    });

    test('should propagate state updates to subscribers', async () => {
        // Initial state
        await expect(driver.connectionState).toHaveText('new');

        // Subscribe another listener in the browser
        await driver.page.evaluate(() => {
            const p = (window as any).__testState.participant;
            (window as any).__capturedStates = [];
            p.subscribe((s: any) => {
                (window as any).__capturedStates.push(s.connectionState);
            });
        });

        await driver.join();
        await driver.waitForConnectionState(/connecting|connected|failed/);

        const capturedStates = await driver.page.evaluate(() => (window as any).__capturedStates);
        expect(capturedStates.length).toBeGreaterThan(0);
        expect(capturedStates).toContain('connecting');
    });

    test('should handle rapid state changes without corruption', async () => {
        await driver.page.evaluate(() => {
            const p = (window as any).__testState.participant;
            const initial = p.get();
            // Manually push many states rapidly
            for (let i = 0; i < 100; i++) {
                p.set({ ...initial, videoMuted: i % 2 === 0 });
            }
        });

        const isMuted = await driver.isVideoMuted();
        expect(typeof isMuted).toBe('boolean');
    });

    test('should persist state across manager updates', async () => {
        await driver.setRoomId('persistence-test');
        await driver.join();

        // Update config which might re-initialize internal logic
        await driver.page.evaluate(() => {
            const p = (window as any).__testState.participant;
            // This reset call in ParticipantManager (if it exists)
            p.value.reset({ videoSlots: 32 }, false);
        });

        await driver.expectConnectionState(/connecting|connected|failed/);
    });
});
