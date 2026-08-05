import { test as base } from '@playwright/test';
import { NetworkSimulator } from '../utils/network-simulator.ts';
import { ParticipantDriver, SdkDriver } from '../utils/participant-driver.ts';
import { uniqueRoom } from './test-data.ts';

type MyFixtures = {
  network: NetworkSimulator;
  // Legacy DOM-driven fixtures (kept for existing specs during the transition).
  driver: ParticipantDriver;
  createDriver: () => Promise<ParticipantDriver>;
  // QoE fixtures: imperative SDK driver + per-test isolation.
  roomId: string;
  sdk: SdkDriver;
  createSdk: () => Promise<SdkDriver>;
};

export const test = base.extend<MyFixtures>({
  network: async ({ context }, use) => {
    const networkSimulator = new NetworkSimulator(context);
    await networkSimulator.reset();
    await use(networkSimulator);
    await networkSimulator.reset();
  },
  driver: async ({ page }, use) => {
    const driver = new ParticipantDriver(page);
    await driver.goto();
    await use(driver);
  },
  createDriver: async ({ browser }, use) => {
    const drivers: ParticipantDriver[] = [];
    const creator = async () => {
      const context = await browser.newContext({
        permissions: ['camera', 'microphone'],
      });
      const page = await context.newPage();
      const driver = new ParticipantDriver(page);
      await driver.goto();
      drivers.push(driver);
      return driver;
    };
    await use(creator);
    // Cleanup
    for (const d of drivers) {
      await d.page.context().close();
    }
  },

  // A unique room per test — the isolation primitive. Never share across tests.
  // Must stay short: the SFU rejects over-long room IDs.
  roomId: async ({}, use) => {
    await use(uniqueRoom('e2e'));
  },

  // Primary QoE fixture: one imperative SDK participant on the default page.
  sdk: async ({ page }, use) => {
    const driver = new SdkDriver(page);
    await driver.goto();
    await use(driver);
    // Teardown: close the participant so no ghost survives server-side. Best-effort.
    try { await driver.close(); } catch { /* page may already be gone */ }
  },

  // Multi-participant QoE fixture: each call is a fresh isolated context.
  createSdk: async ({ browser }, use) => {
    const drivers: SdkDriver[] = [];
    const creator = async () => {
      const context = await browser.newContext({ permissions: ['camera', 'microphone'] });
      const page = await context.newPage();
      const driver = new SdkDriver(page);
      await driver.goto();
      drivers.push(driver);
      return driver;
    };
    await use(creator);
    for (const d of drivers) {
      try { await d.close(); } catch { /* ignore */ }
      await d.page.context().close();
    }
  },
});

export { expect } from '@playwright/test';

