import type { BrowserContext, Page } from '@playwright/test';
import { execSync } from 'child_process';

export interface NetworkConditions {
  delay?: string;      // e.g., '100ms'
  jitter?: string;     // e.g., '20ms'
  loss?: string;       // e.g., '10%'
  rate?: string;       // e.g., '1mbit'
}

export class NetworkSimulator {
  // @ts-ignore
  private context: BrowserContext;
  private interface: string;
  private isThrottled: boolean = false;
  private _isFunctional: boolean = true;

  constructor(context: BrowserContext, networkInterface: string = 'lo') {
    this.context = context;
    this.interface = networkInterface;
    this.checkFunctional();
    this.setupEmergencyCleanup();
  }

  private checkFunctional() {
    try {
      execSync(`sudo -n tc qdisc show dev ${this.interface}`, { stdio: 'ignore' });
      this._isFunctional = true;
    } catch {
      this._isFunctional = false;
      console.warn(`📡 NetworkSimulator: 'tc' is not functional (sudo -n failed). Some tests may be skipped or use fallbacks.`);
    }
  }

  get isFunctional() {
    return this._isFunctional;
  }

  async blockUrls(page: Page, patterns: string[]) {
    await page.route(new RegExp(patterns.join('|')), route => route.abort());
  }

  /**
   * Applies specific constraints or 100% packet loss (shutdown).
   */
  async apply(conditions: NetworkConditions | 'SHUTDOWN') {
    let netemCmd = 'netem';

    if (conditions === 'SHUTDOWN') {
      netemCmd += ' loss 100%';
      // Fallback/Parallel: Use browser-level offline
      await this.context.setOffline(true);
      await this.context.route('**/*', route => route.abort());
    } else {
      const { delay, jitter, loss, rate } = conditions;
      if (delay) netemCmd += ` delay ${delay} ${jitter || ''}`;
      if (loss) netemCmd += ` loss ${loss}`;
      if (rate) netemCmd += ` rate ${rate}`;
    }

    if (this._isFunctional) {
      try {
        // Try 'add' first, if rule exists, 'change' it
        try {
          execSync(`sudo -n tc qdisc add dev ${this.interface} root handle 1: ${netemCmd}`, { stdio: 'ignore' });
        } catch {
          execSync(`sudo -n tc qdisc change dev ${this.interface} root handle 1: ${netemCmd}`, { stdio: 'ignore' });
        }
        this.isThrottled = true;
        console.log(`📡 Network Condition Applied: ${netemCmd}`);
      } catch (error: any) {
        console.warn(`⚠️ TC Warning: Could not apply network conditions (${error.message}).`);
      }
    }
  }

  /**
   * Utility for a clean "Turn off everything"
   */
  async shutdown() {
    await this.apply('SHUTDOWN');
  }

  /**
   * Resets the interface to normal (Deletes the qdisc)
   */
  async reset() {
    await this.context.setOffline(false);
    await this.context.unroute('**/*');
    if (this._isFunctional) {
      try {
        execSync(`sudo -n tc qdisc del dev ${this.interface} root`, { stdio: 'ignore' });
        this.isThrottled = false;
        console.log('✅ Network restored to hardware default.');
      } catch (e) {
        // Silent fail if already deleted
      }
    }
  }

  /**
   * Critical: If the Node process is killed (Ctrl+C), restore the network!
   */
  private setupEmergencyCleanup() {
    const cleanup = () => {
      if (this.isThrottled) {
        console.log('\n🚨 Emergency Network Reset...');
        try { execSync(`sudo -n tc qdisc del dev ${this.interface} root`, { stdio: 'ignore' }); } catch { }
        process.exit();
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}
