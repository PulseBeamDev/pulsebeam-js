import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        viewport: { width: 1280, height: 720 },
        video: 'on-first-retry',
        permissions: ['camera', 'microphone'],
        launchOptions: {
            args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        // `pnpm dev` is `vite build --watch` (a library build) and never binds a
        // port — `playground` is the dev server that serves index.html. --strictPort
        // so a port clash fails loudly instead of silently moving the app.
        command: 'pnpm playground --port 5173 --strictPort',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
