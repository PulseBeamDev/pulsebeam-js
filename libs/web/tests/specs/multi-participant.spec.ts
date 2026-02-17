import { test, expect, TEST_TIMEOUTS } from '../fixtures';
import fc from 'fast-check';
import type { ParticipantDriver } from '../utils/participant-driver';

const JOIN_TIMEOUT = TEST_TIMEOUTS.CONNECTION;
const MEDIA_TIMEOUT = TEST_TIMEOUTS.MEDIA_READY;

test.describe('Multi-Participant Scenarios', () => {
    test('multiple participants joining and leaving stay consistent', async ({ createDriver }) => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        participantIndex: fc.integer({ min: 0, max: 2 }), // 3 participants max
                        action: fc.constantFrom('join', 'leave', 'toggleVideo') as fc.Arbitrary<'join' | 'leave' | 'toggleVideo'>
                    }),
                    { minLength: 4, maxLength: 10 }
                ),
                async (actions) => {
                    // Unique room for each property run
                    const ROOM_ID = `multi-test-${Math.random().toString(36).substring(7)}`;
                    const drivers: (ParticipantDriver | null)[] = [null, null, null];

                    try {
                        for (const { participantIndex, action } of actions) {
                            // Lazy initialization of drivers
                            if (!drivers[participantIndex]) {
                                drivers[participantIndex] = await createDriver();
                                await drivers[participantIndex]!.setRoomId(ROOM_ID);
                            }

                            const driver = drivers[participantIndex]!;

                            if (action === 'join') {
                                if (await driver.isJoinVisible()) {
                                    await driver.join();
                                    await driver.waitForConnectionState(/connecting|connected/, JOIN_TIMEOUT);
                                }
                            } else if (action === 'leave') {
                                if (await driver.isLeaveVisible()) {
                                    await driver.leave();
                                    await expect(driver.joinButton).toBeVisible({ timeout: JOIN_TIMEOUT });
                                }
                            } else if (action === 'toggleVideo') {
                                if (await driver.isLeaveVisible()) {
                                    await driver.toggleVideo();
                                }
                            }

                            // Verify global invariants after each action
                            const joinedDrivers = drivers.filter(d => d !== null);
                            const liveDrivers = [];
                            for (const d of joinedDrivers) {
                                if (await d!.isLeaveVisible()) {
                                    liveDrivers.push(d);
                                }
                            }

                            const activeCount = liveDrivers.length;
                            if (activeCount > 1) {
                                // Every live participant should eventually see activeCount - 1 video tracks
                                // We use poll to handle the async nature of WebRTC negotiation
                                for (const d of liveDrivers) {
                                    await expect.poll(async () => d!.getVideoTrackCount(), {
                                        timeout: MEDIA_TIMEOUT,
                                        intervals: [1000, 2000]
                                    }).toBe(activeCount - 1);
                                }
                            } else if (activeCount === 1) {
                                await expect(liveDrivers[0]!.videoTrackCount).toHaveText('0', { timeout: MEDIA_TIMEOUT });
                            }
                        }
                    } finally {
                        // Important: close extra drivers within each property run to avoid resource leaks
                        // and clashing room states.
                        for (const d of drivers) {
                            if (d) await d.page.context().close();
                        }
                    }
                }
            ),
            { numRuns: 2, endOnFailure: true }
        );
    });
});
