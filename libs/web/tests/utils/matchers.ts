/**
 * QoE matchers — the browser-side analog of the Rust simulator's `Check*` steps
 * (`CheckVideoQuality`, `CheckRxBytes`, …). Every threshold lives here ONCE so
 * scenarios stay readable and never re-implement brittle logic. All assertions are
 * tolerance-based (monotonic growth / coarse floors), never exact fps/bitrate —
 * that is what keeps them robust against libwebrtc's non-determinism.
 */
import { expect } from '@playwright/test';
import type { SdkDriver } from './participant-driver';
import { waitForStats, waitFor, type WaitOpts } from './wait';
import {
  totalFramesDecoded,
  maxInboundFrameHeight,
  totalAudioEnergy,
  totalFreezeCount,
  totalFreezeDuration,
  type QoeSnapshot,
} from './qoe';

export interface VideoQualityOpts {
  /** Minimum decoded-frame growth required over the wait window. */
  minFramesDelta?: number;
  /** Minimum received frame height (coarse resolution floor). */
  minHeight?: number;
  timeout?: number;
}

/**
 * Assert real video is being decoded: `framesDecoded` grows by at least
 * `minFramesDelta` and, if requested, reaches at least `minHeight`. Mirrors
 * `VideoQuality::min_frames(n)`.
 */
export async function expectReceivingVideo(
  driver: SdkDriver,
  opts: VideoQualityOpts = {},
): Promise<void> {
  const minFramesDelta = opts.minFramesDelta ?? 10;
  const baseline = totalFramesDecoded(await driver.getStats());
  await waitForStats(
    driver,
    (s) =>
      totalFramesDecoded(s) - baseline >= minFramesDelta &&
      (opts.minHeight === undefined || maxInboundFrameHeight(s) >= opts.minHeight),
    {
      timeout: opts.timeout ?? 25_000,
      message: `video: expected +${minFramesDelta} decoded frames` +
        (opts.minHeight ? ` at ≥${opts.minHeight}px` : ''),
    },
  );
}

export interface AudioFlowOpts {
  /** Minimum growth in cumulative audio energy over the window. */
  minEnergyDelta?: number;
  timeout?: number;
}

/** Assert real (non-silent) audio is playing: `totalAudioEnergy` grows. */
export async function expectAudioFlowing(
  driver: SdkDriver,
  opts: AudioFlowOpts = {},
): Promise<void> {
  const minEnergyDelta = opts.minEnergyDelta ?? 0.0001;
  const baseline = totalAudioEnergy(await driver.getStats());
  await waitForStats(
    driver,
    (s) => totalAudioEnergy(s) - baseline >= minEnergyDelta,
    { timeout: opts.timeout ?? 25_000, message: `audio: expected audio energy to grow` },
  );
}

export interface SmoothVideoOpts {
  /** Observation window (ms) over which freezes are counted. */
  window?: number;
  /** Max new freeze events allowed in the window (libwebrtc: a freeze is an
   * inter-frame gap past ~max(3×avg, avg+150ms)). */
  maxFreezes?: number;
  /** Max added frozen time (seconds) allowed in the window. */
  maxFreezeSeconds?: number;
  /** Video must keep decoding this many frames, so "no freeze" can't be
   * satisfied by simply having no video. */
  minFramesDelta?: number;
}

/**
 * Assert video stays SMOOTH across a disruption: run `disrupt` (e.g. a simulcast
 * layer switch), then over a window require decoded frames to keep growing while
 * freeze events and frozen time stay within budget. This is the browser-side
 * guard for the no-freeze property the Rust simulator's EgressGuard protects —
 * a botched switch or stall shows up here as freezeCount/totalFreezesDuration.
 */
export async function expectSmoothVideo(
  driver: SdkDriver,
  disrupt: () => Promise<void>,
  opts: SmoothVideoOpts = {},
): Promise<void> {
  const window = opts.window ?? 8_000;
  const maxFreezes = opts.maxFreezes ?? 1;
  const maxFreezeSeconds = opts.maxFreezeSeconds ?? 1.0;
  const minFramesDelta = opts.minFramesDelta ?? 30;

  const before = await driver.getStats();
  const freezeBase = totalFreezeCount(before);
  const durBase = totalFreezeDuration(before);
  const framesBase = totalFramesDecoded(before);

  await disrupt();
  await new Promise((r) => setTimeout(r, window));

  const after = await driver.getStats();
  const freezes = totalFreezeCount(after) - freezeBase;
  const frozenSeconds = totalFreezeDuration(after) - durBase;
  const frames = totalFramesDecoded(after) - framesBase;

  expect(frames, `video kept decoding over ${window}ms`).toBeGreaterThanOrEqual(minFramesDelta);
  expect(freezes, `freeze events over ${window}ms`).toBeLessThanOrEqual(maxFreezes);
  expect(frozenSeconds, `frozen seconds over ${window}ms`).toBeLessThanOrEqual(maxFreezeSeconds);
}

export async function expectConnected(driver: SdkDriver, opts: WaitOpts = {}): Promise<void> {
  await waitFor(
    async () => (await driver.getState()).connectionState,
    (state) => state === 'connected',
    { timeout: opts.timeout ?? 15_000, message: 'expected connectionState=connected' },
  );
}

export async function expectDisconnected(driver: SdkDriver, opts: WaitOpts = {}): Promise<void> {
  await waitFor(
    async () => (await driver.getState()).connectionState,
    (state) => ['disconnected', 'failed', 'closed'].includes(state),
    { timeout: opts.timeout ?? 15_000, message: 'expected connection to drop' },
  );
}

export interface RecoverOpts {
  minFramesDelta?: number;
  minEnergyDelta?: number;
  video?: boolean;
  audio?: boolean;
  timeout?: number;
}

/**
 * Baseline current media, run a disruption, then assert media resumes ABOVE the
 * pre-disruption baseline. The robust way to test reconnect/churn recovery without
 * timing assumptions — mirrors the sim's partition→repair→`CheckVideoQuality`.
 */
export async function expectStreamRecovers(
  driver: SdkDriver,
  disrupt: () => Promise<void>,
  opts: RecoverOpts = {},
): Promise<void> {
  const wantVideo = opts.video ?? true;
  const wantAudio = opts.audio ?? false;
  const before = await driver.getStats();
  const videoBase = totalFramesDecoded(before);
  const audioBase = totalAudioEnergy(before);

  await disrupt();

  const minFramesDelta = opts.minFramesDelta ?? 10;
  const minEnergyDelta = opts.minEnergyDelta ?? 0.0001;
  await waitForStats(
    driver,
    (s) =>
      (!wantVideo || totalFramesDecoded(s) - videoBase >= minFramesDelta) &&
      (!wantAudio || totalAudioEnergy(s) - audioBase >= minEnergyDelta),
    { timeout: opts.timeout ?? 40_000, message: 'expected media to recover above baseline' },
  );
}

export type { QoeSnapshot };
