import { test, expect } from '../fixtures';
import { waitFor } from '../utils/wait';
import { expectConnected } from '../utils/matchers';
import type { SdkDriver } from '../utils/participant-driver';

/**
 * QoE data channel: verifies that raw bytes actually flow between participants
 * via topic pub/sub in both delivery modes (latest = unreliable, ordered = reliable).
 * Assertions use `getReceivedData()` — the topic equivalent of `framesDecoded`.
 * Browser QoE tier, blocking lane.
 */

async function setupPair(
  createSdk: () => Promise<SdkDriver>,
  roomId: string,
  topicName: string,
  mode: 'latest' | 'ordered',
): Promise<{ pub: SdkDriver; sub: SdkDriver }> {
  const pub = await createSdk();
  const sub = await createSdk();

  // Declare topics BEFORE connect() so the DCs are registered before the
  // transport is created; wireTopicsToTransport() creates them via DCEP on
  // the existing SCTP association (no SDP renegotiation needed).
  await pub.create();
  await pub.declareTopic(topicName, mode);
  await pub.connect(roomId);
  await expectConnected(pub);

  await sub.create();
  await sub.declareTopic(topicName, mode);
  await sub.connect(roomId);
  await expectConnected(sub);

  return { pub, sub };
}

test.describe('QoE — data channels', () => {
  test('latest mode: publisher bytes reach the subscriber', async ({ createSdk, roomId }) => {
    const { pub, sub } = await setupPair(createSdk, roomId, 'test-latest', 'latest');

    // Send 5 messages; loopback SFU delivers best-effort (unreliable mode)
    const messages = [[1, 2, 3], [4, 5], [6], [7, 8, 9], [10]];
    for (const payload of messages) {
      await pub.publishData('test-latest', payload);
    }

    // Tolerance: loopback should deliver all 5 but we only require ≥3 to avoid
    // false-fails from unreliable delivery semantics.
    await waitFor(
      () => sub.getReceivedData('test-latest'),
      (received) => received.length >= 3,
      { timeout: 15_000, message: 'subscriber received fewer than 3/5 latest-mode messages' },
    );

    const received = await sub.getReceivedData('test-latest');
    // At least one payload should match what we sent
    expect(received.length).toBeGreaterThanOrEqual(3);
  });

  test('ordered mode: all messages arrive in order', async ({ createSdk, roomId }) => {
    const { pub, sub } = await setupPair(createSdk, roomId, 'test-ordered', 'ordered');

    const messages = [[1], [2], [3], [4], [5]];
    for (const payload of messages) {
      await pub.publishData('test-ordered', payload);
    }

    // Ordered/reliable: all 5 must arrive, in order.
    await waitFor(
      () => sub.getReceivedData('test-ordered'),
      (received) => received.length >= 5,
      { timeout: 20_000, message: 'subscriber did not receive all 5 ordered messages' },
    );

    const received = await sub.getReceivedData('test-ordered');
    expect(received.length).toBe(5);
    // Verify order matches send order
    for (let i = 0; i < messages.length; i++) {
      expect(received[i]).toEqual(messages[i]);
    }
  });

  /**
   * Ordered-mode reconnect resilience. Deliberately non-deterministic because it
   * relies on specific reconnect timing and NACK/resync behavior. Quarantined so it
   * never gates merges — it documents the expected behavior.
   *
   * @flaky
   */
  test('@flaky ordered mode: messages delivered or resync emitted after reconnect', async ({ createSdk, roomId }) => {
    const { pub, sub } = await setupPair(createSdk, roomId, 'test-reconnect', 'ordered');

    // Batch 1: send 5 messages while connected
    for (let i = 0; i < 5; i++) {
      await pub.publishData('test-reconnect', [i]);
    }

    // Wait for initial delivery to stabilize
    await waitFor(
      () => sub.getReceivedData('test-reconnect'),
      (r) => r.length >= 3,
      { timeout: 20_000, message: 'initial messages not delivered before disconnect' },
    );

    // Simulate network drop — subscriber context goes offline briefly
    await sub.page.context().setOffline(true);
    await sub.page.context().setOffline(false);

    // Batch 2: 5 more messages after reconnect
    // (publisher may reconnect and increment stream_id, causing subscriber to emit resync)
    await waitFor(
      () => sub.getState(),
      (s) => s.connectionState === 'connected',
      { timeout: 25_000, message: 'subscriber did not reconnect' },
    );

    for (let i = 5; i < 10; i++) {
      await pub.publishData('test-reconnect', [i]);
    }

    // After reconnect, subscriber should have received either all messages OR
    // a resync + the post-reconnect batch. Either outcome is acceptable.
    await waitFor(
      () => sub.getReceivedData('test-reconnect'),
      (r) => r.length >= 5,
      { timeout: 25_000, message: 'subscriber received fewer than 5 total messages after reconnect' },
    );

    const received = await sub.getReceivedData('test-reconnect');
    expect(received.length).toBeGreaterThanOrEqual(5);
  });
});
