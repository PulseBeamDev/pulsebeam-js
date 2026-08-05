import { defineConfig, devices } from '@playwright/test';

// Pin the SFU to a specific commit build — the protocol has breaking changes, so
// `latest`/`v0.4.6` will not match the client's signaling.proto. The registry tags
// each build with its short commit hash, so the tag IS the commit. Bump this pin
// deliberately whenever the proto changes.
const imageTag = process.env.IMAGE_TAG || '60434c1';
const imageName = `ghcr.io/pulsebeamdev/pulsebeam:${imageTag}`;

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
      command: `podman run --rm --name sfu-test --net=host ${imageName} --dev`,
      url: 'http://localhost:6060/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    }
  ],
});
