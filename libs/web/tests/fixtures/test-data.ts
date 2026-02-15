/**
 * Test constants and data for E2E tests
 */

export const TEST_ROOMS = {
  BASIC: 'e2e-web-basic',
  MULTI_PARTICIPANT: 'e2e-web-multi',
  RECONNECTION: 'e2e-web-reconnect',
  TRACKS: 'e2e-web-tracks',
} as const;

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
  baseUrl: 'http://localhost:3000/api/v1',
} as const;
