import { expect } from '@playwright/test';
import { ParticipantDriver } from './participant-driver';

/**
 * Custom assertions for vanilla TS tests
 */
export class Assertions {
    static async expectConnectionState(
        driver: ParticipantDriver,
        expectedState: string | RegExp
    ) {
        await expect(driver.connectionState).toHaveText(expectedState);
    }

    static async expectTrackCounts(
        driver: ParticipantDriver,
        videoCount: number,
        audioCount: number
    ) {
        await driver.expectVideoTrackCount(videoCount);
        await driver.expectAudioTrackCount(audioCount);
    }
}
