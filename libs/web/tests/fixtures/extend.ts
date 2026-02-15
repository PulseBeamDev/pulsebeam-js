import { test as base } from '@playwright/test';
import { NetworkSimulator } from '../utils/network-simulator.ts';
import { ParticipantDriver } from '../utils/participant-driver.ts';

type MyFixtures = {
  network: NetworkSimulator;
  driver: ParticipantDriver;
};

export const test = base.extend<MyFixtures>({
  network: async ({ context }, use) => {
    const networkSimulator = new NetworkSimulator(context);
    networkSimulator.reset();
    await use(networkSimulator);
    networkSimulator.reset();
  },
  driver: async ({ page }, use) => {
    const driver = new ParticipantDriver(page);
    await driver.goto();
    await use(driver);
  },
});

export { expect } from '@playwright/test';

