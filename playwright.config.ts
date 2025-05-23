import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 4 : 0,
  /* Opt out of parallel tests on CI. */
  // workers: process.env.CI ? 1 : 1,
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", "list"],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    // trace: process.env.CI ? "retain-on-failure" : 'on',
    trace: "retain-on-failure",
  },

  webServer: {
    command: "npm run dev -w @pulsebeam/demo-react",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "local",
      use: {
        baseURL: "http://127.0.0.1:5173",
        ignoreHTTPSErrors: true,
      },
      retries: 2,
    },
    {
      name: "production",
      use: {
        baseURL: "https://meet.lukas-coding.us/",
      },
      retries: 2,
    },
  ],
  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
