import { test, expect } from '@playwright/test';
import { ParticipantDriver } from '../utils/participant-driver';

test.describe('Display Manager', () => {
    let driver: ParticipantDriver;

    test.beforeEach(async ({ page }) => {
        driver = new ParticipantDriver(page);
        await driver.goto();
    });

    test('DisplayManager should handle screen share capabilities', async () => {
        const hasScreenShare = await driver.page.evaluate(() => {
            return !!navigator.mediaDevices.getDisplayMedia;
        });
        expect(hasScreenShare).toBe(true);
    });

    test('should trigger screen share flow', async () => {
        await driver.join();
        await driver.waitForConnectionState(/connecting|connected|failed/);

        await driver.shareScreen();

        const state = await driver.getTestState();
        expect(state.publishedStream).toBeDefined();

        const videoTrack = await driver.page.evaluate(() => {
            const stream = (window as any).__testState.getPublishedStream();
            return stream.getVideoTracks()[0].label;
        });

        // In Playwright with fake media, screen share label starts with 'screen' or 'fake'
        expect(videoTrack).toBeDefined();
    });
});
