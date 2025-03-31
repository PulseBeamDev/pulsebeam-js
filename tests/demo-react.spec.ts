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

const PRESETS = {
  baseUrl: PULSEBEAM_BASE_URL,
  forceRelay: "on",
  mock: "on",
};

function toUrl(base: string, presets: typeof PRESETS): string {
  return base +
    `?mock=${presets.mock}&baseUrl=${presets.baseUrl}&forceRelay=${presets.forceRelay}`;
}

// https://playwright.dev/docs/test-retries#serial-mode
test.describe.configure({ mode: "serial" });

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
      await page.waitForTimeout(delayMs).catch(() => { });
      return;
    } catch (_e) {
      await page.waitForTimeout(1000).catch(() => { });
    }
  }

  throw new Error("waitForStableVideo timeout");
}

async function assertClick(btn: Locator) {
  await btn.click({ timeout: 1000 }).catch(() => { });
  await expect(btn).not.toBeVisible();
}

async function start(page: Page, groupId: string, peerId: string) {
  await page.getByTestId("src-groupId").fill(groupId);
  await page.getByTestId("src-peerId").fill(peerId);
  await waitForStableVideo(page, peerId, 5_000);

  await assertClick(page.getByTestId("btn-ready"));

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
  const url = toUrl(baseURL!, PRESETS);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
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
      const url = toUrl(baseURL!, PRESETS);
      const group = `${randId()}`;
      const peerA = `__${bA}_A`;
      const peerB = `__${bB}_B`;

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
          start(pageB, group, peerB),
          start(pageA, group, peerA),
        ]);
        await Promise.all([
          waitForStableVideo(pageB, peerA, 10_000),
          waitForStableVideo(pageA, peerB, 10_000),
        ]);
        await Promise.all([closeA(), closeB()]);
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });

    // Disconnect and reconnect with role reversal
    test(`${bA}_${bB} disconnect and reconnect`, async ({ baseURL }) => {
      const url = toUrl(baseURL!, PRESETS);
      const group = `${randId()}`;
      const peerA = `__${bA}_A`;
      const peerB = `__${bB}_B`;

      const contextA = await browsers[bA].newContext();
      const pageA = await contextA.newPage();
      await pageA.goto(url);

      const contextB = await browsers[bB].newContext();
      const pageB = await contextB.newPage();
      await pageB.goto(url);

      try {
        // Initial connection B -> A
        const [closeA, closeB] = await Promise.all([
          start(pageA, group, peerA),
          start(pageB, group, peerB),
        ]);

        // End call
        await Promise.all([closeA(), closeB()]);

        // Verify streams stopped
        await expect(pageA.getByTestId(peerB)).toHaveCount(0);
        await expect(pageB.getByTestId(peerA)).toHaveCount(0);

        // Reconnect with reversed roles A -> B
        const [closeB2, closeA2] = await Promise.all([
          start(pageB, group, peerB),
          start(pageA, group, peerA),
        ]);
        await Promise.all([
          waitForStableVideo(pageB, peerA, 10_000),
          waitForStableVideo(pageA, peerB, 10_000),
        ]);

        await Promise.all([closeA2(), closeB2()]);
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });
  }
});
