import { defineConfig, devices } from '@playwright/test';

// Pin the SFU by DIGEST, not tag. The protocol has breaking changes (so
// `latest`/`v0.4.6` will not match the client's signaling.proto), and tags are
// mutable — `main` moves under us and branch tags like `dd-native` disappear once
// merged. A digest is immutable, so what CI runs is exactly what was verified here.
//
// This pin is the SINGLE source of truth: the workflows deliberately do NOT set
// IMAGE_TAG. Bump it only after running the QoE suite green against the new digest.
// Requirements of the pinned build: signaling.proto compatible, and DD-native
// forwarding (forwards on the Dependency Descriptor) — see qoe.e2ee.spec.ts.
const SFU_DIGEST =
  'sha256:abc4ca7d7c25ef9fdfd32e6d96ac14c8220e0fa934077834fca8bcb75871c7bd';
// Escape hatch for the nightly drift-detector, which deliberately tests a moving
// tag (`main`) to catch server-side breakage before it reaches a pin.
const imageName = process.env.IMAGE_TAG
  ? `ghcr.io/pulsebeamdev/pulsebeam:${process.env.IMAGE_TAG}`
  : `ghcr.io/pulsebeamdev/pulsebeam@${SFU_DIGEST}`;

// The @flaky lane (netem/chaos) runs only when explicitly requested, so the default
// (blocking) run stays near-zero flake. CI runs the flaky job with RUN_FLAKY=1.
const runFlaky = !!process.env.RUN_FLAKY;

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sequential for stability
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  timeout: 60000, // 60s per test
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-file-access'
      ],
    },
  },
  projects: [
    {
      // Blocking lane: everything EXCEPT @flaky. Must be near-zero flake.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@flaky/,
    },
    // Non-blocking lane: only @flaky (netem/chaos). Included only when RUN_FLAKY=1
    // so default/dev runs never see it. CI runs it as a separate, non-gating job.
    ...(runFlaky
      ? [{
          name: 'chromium-flaky',
          use: { ...devices['Desktop Chrome'] },
          grep: /@flaky/,
          retries: 1,
        }]
      : []),
  ],
  webServer: [
    {
      // Vite DEV server (serves tests/fixtures/test-page.html with the @pulsebeam/core
      // source alias). Note: `pnpm dev` is `vite build --watch` (a library build), which
      // does not serve — use the dedicated dev-server script instead.
      command: 'pnpm test:serve --port 5175',
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      // --replace so a leftover container from an interrupted run (or a concurrent
      // turbo lane) fails the run with a real error instead of "name already in use".
      command: `podman run --rm --replace --name sfu-test --net=host ${imageName} --dev`,
      url: 'http://localhost:6060/healthz',
      // NEVER reuse, not even locally. /healthz reports liveness but not identity
      // (no version/build endpoint exists), so reusing "whatever is listening on
      // 6060" silently tests an unknown image — a stale container from another
      // image made this suite look green locally while CI failed. --replace makes
      // taking the port over safe, so always start the pinned image.
      reuseExistingServer: false,
      timeout: 120000,
    }
  ],
});
