import { test, expect, TEST_TIMEOUTS, TEST_ROOMS } from '../fixtures';
import fc from 'fast-check';
import type { ParticipantDriver } from '../utils/participant-driver';

type Action =
  | { type: 'setRoom'; value: string }
  | { type: 'join' }
  | { type: 'leave' };

const ROOM_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-'.split('');
const roomIdArb = fc
  .stringOf(fc.constantFrom(...ROOM_ID_CHARS), { minLength: 3, maxLength: 16 })
  .map(value => `room-${value}`);
const actionArb = fc.oneof(
  fc.record({ type: fc.constant('setRoom'), value: roomIdArb }),
  fc.constant({ type: 'join' }),
  fc.constant({ type: 'leave' })
) as fc.Arbitrary<Action>;

const JOIN_TIMEOUT = TEST_TIMEOUTS.CONNECTION;
const RECONNECT_TIMEOUT = TEST_TIMEOUTS.RECONNECTION;

async function assertUiInvariants(driver: ParticipantDriver) {
  await expect(driver.connectionState).toBeVisible();

  const joinVisible = await driver.isJoinVisible();
  const leaveVisible = await driver.isLeaveVisible();
  expect(joinVisible || leaveVisible).toBe(true);
  expect(joinVisible && leaveVisible).toBe(false);

  const roomEnabled = await driver.isRoomInputEnabled();
  if (joinVisible) {
    expect(roomEnabled).toBe(true);
  } else {
    expect(roomEnabled).toBe(false);
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

test.describe('Connection Lifecycle', () => {
  test('randomized room and join/leave actions stay consistent', async ({ driver, page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await fc.assert(
      fc.asyncProperty(fc.array(actionArb, { minLength: 6, maxLength: 18 }), async (actions: Action[]) => {
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

          await assertUiInvariants(driver);
        }
      }),
      { numRuns: process.env.CI ? 10 : 16 }
    );

    expect(pageErrors).toHaveLength(0);
  });

  test('should automatically reconnect after network failure', async ({ driver, network }) => {
    test.skip(!network.isFunctional, 'TC not functional, cannot reliably test network recovery with setOffline');

    await driver.setRoomId(TEST_ROOMS.RECONNECTION);
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected/, JOIN_TIMEOUT);

    await network.shutdown();
    await driver.waitForConnectionState(/failed|disconnected/, 30000);

    await network.reset();
    await driver.waitForConnectionState(/connecting|connected/, RECONNECT_TIMEOUT);
    await assertUiInvariants(driver);
  });

  test('should report failed state after prolonged network loss', async ({ driver, network }) => {
    test.skip(!network.isFunctional, 'TC not functional, browser may not time out ICE connection fast enough');

    await driver.setRoomId(TEST_ROOMS.RECONNECTION);
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected/, JOIN_TIMEOUT);

    await network.shutdown();
    await driver.page.waitForTimeout(5000);
    await driver.expectConnectionState(/failed|disconnected/);
  });
});
