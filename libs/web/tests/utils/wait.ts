import { expect } from '@playwright/test';
import type { SdkDriver } from './participant-driver';
import type { QoeSnapshot } from './qoe';

export interface WaitOpts {
  /** Overall budget for the condition to become true. */
  timeout?: number;
  /** Poll backoff schedule (ms between samples). */
  intervals?: number[];
  /** Human-readable label surfaced when the wait fails. */
  message?: string;
}

const DEFAULT_INTERVALS = [250, 500, 500, 1000, 1000, 2000];

/**
 * Condition-based waiting on a QoE snapshot — the ONLY sanctioned way to wait in
 * this suite (fixed sleeps are ESLint-banned). Polls `driver.getStats()` until
 * `predicate` holds or the timeout elapses.
 */
export async function waitForStats(
  driver: SdkDriver,
  predicate: (stats: QoeSnapshot) => boolean,
  opts: WaitOpts = {},
): Promise<void> {
  await expect
    .poll(async () => predicate(await driver.getStats()), {
      timeout: opts.timeout ?? 20_000,
      intervals: opts.intervals ?? DEFAULT_INTERVALS,
      message: opts.message,
    })
    .toBe(true);
}

/**
 * Poll an arbitrary async sample until `predicate` holds. For state that isn't in
 * `getStats()` (e.g. connectionState, discovered tracks).
 */
export async function waitFor<T>(
  sample: () => Promise<T>,
  predicate: (value: T) => boolean,
  opts: WaitOpts = {},
): Promise<void> {
  await expect
    .poll(async () => predicate(await sample()), {
      timeout: opts.timeout ?? 15_000,
      intervals: opts.intervals ?? DEFAULT_INTERVALS,
      message: opts.message,
    })
    .toBe(true);
}
