import { test as base } from '@playwright/test';
import { NetworkSimulator } from '../utils/network-simulator.ts';
import { ParticipantDriver } from '../utils/participant-driver.ts';

type MyFixtures = {
  network: NetworkSimulator;
  driver: ParticipantDriver;
  createDriver: () => Promise<ParticipantDriver>;
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
});

export { expect } from '@playwright/test';

