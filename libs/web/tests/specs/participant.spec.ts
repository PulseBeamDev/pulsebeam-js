import { test, expect, TEST_TIMEOUTS } from '../fixtures';
import fc from 'fast-check';
import type { ParticipantDriver } from '../utils/participant-driver';

type Action =
  | { type: 'setRoom'; value: string }
  | { type: 'join' }
  | { type: 'leave' }
  | { type: 'toggleVideo' }
  | { type: 'toggleAudio' };

const ROOM_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-'.split('');
const roomIdArb = fc
  .stringOf(fc.constantFrom(...ROOM_ID_CHARS), { minLength: 3, maxLength: 16 })
  .map(value => `room-${value}`);
const actionArb: fc.Arbitrary<Action> = fc.oneof(
  fc.record({ type: fc.constant('setRoom' as const), value: roomIdArb }),
  fc.constant({ type: 'join' as const }),
  fc.constant({ type: 'leave' as const }),
  fc.constant({ type: 'toggleVideo' as const }),
  fc.constant({ type: 'toggleAudio' as const })
);

const JOIN_TIMEOUT = TEST_TIMEOUTS.CONNECTION;
const TOGGLE_TIMEOUT = TEST_TIMEOUTS.STATE_CHANGE;

function oppositeVideoLabel(label: string) {
  return label === 'Mute Video' ? 'Unmute Video' : 'Mute Video';
}

function oppositeAudioLabel(label: string) {
  return label === 'Mute Audio' ? 'Unmute Audio' : 'Mute Audio';
}

async function assertUiInvariants(driver: ParticipantDriver) {
  const joinVisible = await driver.isJoinVisible();
  const leaveVisible = await driver.isLeaveVisible();
  expect(joinVisible || leaveVisible).toBe(true);
  expect(joinVisible && leaveVisible).toBe(false);

  const roomEnabled = await driver.isRoomInputEnabled();
  if (joinVisible) {
    expect(roomEnabled).toBe(true);
    await expect(driver.toggleVideoButton).toBeHidden();
    await expect(driver.toggleAudioButton).toBeHidden();
    await expect(driver.shareScreenButton).toBeHidden();
  } else {
    expect(roomEnabled).toBe(false);
    await expect(driver.toggleVideoButton).toBeVisible();
    await expect(driver.toggleAudioButton).toBeVisible();
    await expect(driver.shareScreenButton).toBeVisible();
  }
}

async function waitForJoinReady(driver: ParticipantDriver) {
  await expect(driver.joinButton).toBeVisible({ timeout: JOIN_TIMEOUT });
  await expect(driver.connectionState).toHaveText(/new|disconnected|closed|failed/);
}

async function waitForLeaveReady(driver: ParticipantDriver) {
  await expect(driver.leaveButton).toBeVisible({ timeout: JOIN_TIMEOUT });
  await expect(driver.connectionState).toHaveText(/connecting|connected|failed/);
}

test.describe('Participant Manager', () => {
  test('randomized UI actions remain consistent', async ({ driver, page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await fc.assert(
      fc.asyncProperty(fc.array(actionArb, { minLength: 8, maxLength: 20 }), async (actions: Action[]) => {
        await driver.goto();
        await assertUiInvariants(driver);

        for (const action of actions) {
          if (action.type === 'setRoom') {
            if (await driver.isRoomInputEnabled()) {
              await driver.setRoomId(action.value);
              await expect(driver.roomInput).toHaveValue(action.value);
            }
          }

          if (action.type === 'join') {
            if (await driver.isJoinVisible()) {
              await driver.join();
              await waitForLeaveReady(driver);
            }
          }

          if (action.type === 'leave') {
            if (await driver.isLeaveVisible()) {
              await driver.leave();
              await waitForJoinReady(driver);
            }
          }

          if (action.type === 'toggleVideo') {
            if (await driver.isLeaveVisible()) {
              const before = await driver.getVideoToggleLabel();
              await driver.toggleVideo();
              await expect
                .poll(async () => driver.getVideoToggleLabel(), { timeout: TOGGLE_TIMEOUT })
                .toBe(oppositeVideoLabel(before));
            }
          }

          if (action.type === 'toggleAudio') {
            if (await driver.isLeaveVisible()) {
              const before = await driver.getAudioToggleLabel();
              await driver.toggleAudio();
              await expect
                .poll(async () => driver.getAudioToggleLabel(), { timeout: TOGGLE_TIMEOUT })
                .toBe(oppositeAudioLabel(before));
            }
          }

          await assertUiInvariants(driver);
        }
      }),
      { numRuns: process.env.CI ? 10 : 16 }
    );

    expect(pageErrors).toHaveLength(0);
  });

  test('publishing local media yields tracks and cleans up on leave', async ({ driver }) => {
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/);

    await expect
      .poll(async () => driver.getVideoTrackCount(), { timeout: TEST_TIMEOUTS.MEDIA_READY })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => driver.getAudioTrackCount(), { timeout: TEST_TIMEOUTS.MEDIA_READY })
      .toBeGreaterThan(0);

    await driver.leave();
    await waitForJoinReady(driver);
    await driver.expectVideoTrackCount(0);
    await driver.expectAudioTrackCount(0);
  });
});
