import {
  chromium as bChromium,
  firefox as bFirefox,
  Locator,
  // webkit as bWebkit,
} from "playwright";
import { Browser, expect, type Page, test } from "@playwright/test";

// npx playwright test --list
// npx playwright test --project=local --repeat-each 15 --grep "chromium_chromium disconnect and reconnect"

const PULSEBEAM_BASE_URL = process.env.PULSEBEAM_BASE_URL ||
  "https://cloud.pulsebeam.dev/grpc";

async function waitForStableVideo(
  page: Page,
  peerId: string,
  timeoutMs: number,
  delayMs = 0,
) {
  // return page.waitForFunction(({ peerId, durationSeconds }) => {
  //   const video = document.querySelector(`video[data-testid=${peerId}]`) as HTMLVideoElement;
  //   return !!video && !video.paused && video.currentTime > durationSeconds;
  // }, { peerId, durationSeconds });

  const video = page.getByTestId(peerId);
  const start = performance.now();

  while ((performance.now() - start) < timeoutMs) {
    try {
      expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(
        false,
      );
      expect(await video.evaluate((v: HTMLVideoElement) => v.ended)).toBe(
        false,
      );
      expect(await video.evaluate((v: HTMLVideoElement) => v.readyState)).toBe(
        4,
      );
      await page.waitForTimeout(delayMs).catch(() => {});
      return;
    } catch (_e) {
      await page.waitForTimeout(1000).catch(() => {});
    }
  }

  throw new Error("waitForStableVideo timeout");
}

async function assertClick(btn: Locator) {
  await btn.click({ timeout: 50 }).catch(() => {});
  await expect(btn).not.toBeVisible();
}

async function start(page: Page, peerId: string) {
  await page.getByTestId("src-peerId").fill(peerId);
  await waitForStableVideo(page, peerId, 5_000);

  await page.getByTestId("btn-ready").click();

  return () => assertClick(page.getByTestId("btn-endCall"));
}

async function connect(page: Page, peerId: string, otherPeerId: string) {
  start(page, peerId);
  await page.getByTestId("dst-peerId").fill(otherPeerId);
  await page.getByTestId("btn-connect").click();
  await expect(page.getByTestId("btn-connect")).toHaveCount(0);
  await waitForStableVideo(page, otherPeerId, 10_000);

  return () => assertClick(page.getByTestId("btn-endCall"));
}

function randId() {
  return Math.floor(Math.random() * 2 ** 32);
}

function getAllPairs<T>(list: T[]): [T, T][] {
  const pairs: [T, T][] = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i; j < list.length; j++) {
      pairs.push([list[i], list[j]]);
    }
  }
  return pairs;
}

test(`load`, async ({ browser, browserName, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseURL! + "?mock");
  await waitForStableVideo(page, "", 1000);
});

test.describe("Connect", () => {
  const browserNames = ["chromium", "firefox"];
  const browsers: Record<string, Browser> = {};
  const pairs: [string, string][] = getAllPairs(browserNames);

  test.beforeAll(async () => {
    const [chromium, firefox] = await Promise.all([
      bChromium.launch({}),
      bFirefox.launch(),
      // webkit still doesn't allow fake webcam
      // https://github.com/microsoft/playwright/issues/2973
      // bWebkit.launch(),
    ]);

    browsers["chromium"] = chromium;
    browsers["firefox"] = firefox;
    // browsers["webkit"] = webkit;
  });

  // basic connection test a->b
  for (const [bA, bB] of pairs) {
    test(`${bA}_${bB} basic connection`, async ({ baseURL }) => {
      const url = baseURL + "?mock&baseUrl=" + PULSEBEAM_BASE_URL;
      const peerA = `__${bA}_${randId()}`;
      const peerB = `__${bB}_${randId()}`;

      // Launch browserA for pageA
      const contextA = await browsers[bA].newContext();
      const pageA = await contextA.newPage();
      await pageA.goto(url);

      // Launch browserB for pageB
      const contextB = await browsers[bB].newContext();
      const pageB = await contextB.newPage();
      await pageB.goto(url);

      try {
        // Initial connection B -> A
        const [closeA, closeB] = await Promise.all([
          start(pageB, peerB),
          connect(pageA, peerA, peerB),
        ]);
        await Promise.all([closeA(), closeB()]);
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });

    // Disconnect and reconnect with role reversal
    test(`${bA}_${bB} disconnect and reconnect`, async ({ baseURL }) => {
      const url = `${baseURL}?mock&baseUrl=${PULSEBEAM_BASE_URL}`;
      const peerA = `__${bA}_${randId()}`;
      const peerB = `__${bB}_${randId()}`;

      const contextA = await browsers[bA].newContext();
      const pageA = await contextA.newPage();
      await pageA.goto(url);

      const contextB = await browsers[bB].newContext();
      const pageB = await contextB.newPage();
      await pageB.goto(url);

      try {
        // Initial connection B -> A
        const [closeA, closeB] = await Promise.all([
          start(pageA, peerA),
          connect(pageB, peerB, peerA),
        ]);

        // End call
        await Promise.all([closeA(), closeB()]);

        // Verify streams stopped
        await expect(pageA.getByTestId(peerB)).toHaveCount(0);
        await expect(pageB.getByTestId(peerA)).toHaveCount(0);

        // Reconnect with reversed roles A -> B
        const [closeB2, closeA2] = await Promise.all([
          start(pageB, peerB),
          connect(pageA, peerA, peerB),
        ]);

        await Promise.all([closeA2(), closeB2()]);
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });

    // Simultaneous connection attempt
    test(`${bA}_${bB} simultaneous connect`, async ({ baseURL }) => {
      const url = `${baseURL}?mock&baseUrl=${PULSEBEAM_BASE_URL}`;
      const peerA = `__${bA}_${randId()}`;
      const peerB = `__${bB}_${randId()}`;

      const contextA = await browsers[bA].newContext();
      const pageA = await contextA.newPage();
      await pageA.goto(url);

      const contextB = await browsers[bB].newContext();
      const pageB = await contextB.newPage();
      await pageB.goto(url);

      try {
        // Both peers ready
        const [closeA, closeB] = await Promise.all([
          start(pageA, peerA),
          start(pageB, peerB),
        ]);

        // Set destination IDs
        await Promise.all([
          pageA.getByTestId("dst-peerId").fill(peerB),
          pageB.getByTestId("dst-peerId").fill(peerA),
        ]);

        // Race between clicking and have the other peer to connect first
        // Attempt simultaneous connection
        await Promise.all([
          assertClick(pageA.getByTestId("btn-connect")),
          assertClick(pageB.getByTestId("btn-connect")),
        ]);

        await waitForStableVideo(pageA, peerB, 10_000),
          await waitForStableVideo(pageB, peerA, 10_000),
          await Promise.all([closeA(), closeB()]);
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });
  }
});
