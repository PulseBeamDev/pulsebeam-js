import { Page, BrowserContext } from '@playwright/test';

/**
 * Utilities for simulating network conditions
 */
export class NetworkSimulator {
    private context: BrowserContext;

    constructor(context: BrowserContext) {
        this.context = context;
    }

    async goOffline() {
        await this.context.setOffline(true);
    }

    async goOnline() {
        await this.context.setOffline(false);
    }

    async blockUrls(page: Page, patterns: string[]) {
        await page.route(new RegExp(patterns.join('|')), route => route.abort());
    }
}
