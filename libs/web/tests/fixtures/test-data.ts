/**
 * Test constants and data for E2E tests
 */

/**
 * @deprecated Fixed room names bleed server-side state across tests. New (QoE)
 * specs use the `roomId` fixture / `uniqueRoom()` for full per-test isolation.
 */
export const TEST_ROOMS = {
  BASIC: 'e2e-web-basic',
  MULTI_PARTICIPANT: 'e2e-web-multi',
  RECONNECTION: 'e2e-web-reconnect',
  TRACKS: 'e2e-web-tracks',
} as const;

/**
 * A unique room per call — the isolation primitive for QoE specs. Kept short: the
 * SFU rejects over-long room IDs ("ID exceeds maximum length"), so this is a fixed
 * ~14-char id, not derived from the (long) test title.
 */
export function uniqueRoom(prefix = 'e2e'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const t = Date.now().toString(36).slice(-4);
  return `${prefix}-${t}${rand}`;
}

export const TEST_TIMEOUTS = {
  CONNECTION: 10000,
  RECONNECTION: 15000,
  MEDIA_READY: 5000,
  STATE_CHANGE: 3000,
} as const;

export const CONNECTION_STATES = [
  'new',
  'connecting',
  'connected',
  'disconnected',
  'failed',
  'closed',
] as const;

export const MOCK_CONFIG = {
  videoSlots: 16,
  audioSlots: 8,
  baseUrl: 'http://localhost:7070/api/v1',
} as const;
