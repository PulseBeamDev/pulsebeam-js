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

  constructor(context: BrowserContext, networkInterface: string = 'lo') {
    this.context = context;
    this.interface = networkInterface;
    this.setupEmergencyCleanup();
  }

  async blockUrls(page: Page, patterns: string[]) {
    await page.route(new RegExp(patterns.join('|')), route => route.abort());
  }

  /**
   * Applies specific constraints or 100% packet loss (shutdown).
   */
  apply(conditions: NetworkConditions | 'SHUTDOWN') {
    let netemCmd = 'netem';

    if (conditions === 'SHUTDOWN') {
      netemCmd += ' loss 100%';
    } else {
      const { delay, jitter, loss, rate } = conditions;
      if (delay) netemCmd += ` delay ${delay} ${jitter || ''}`;
      if (loss) netemCmd += ` loss ${loss}`;
      if (rate) netemCmd += ` rate ${rate}`;
    }

    try {
      // Try 'add' first, if rule exists, 'change' it
      try {
        execSync(`sudo tc qdisc add dev ${this.interface} root handle 1: ${netemCmd}`);
      } catch {
        execSync(`sudo tc qdisc change dev ${this.interface} root handle 1: ${netemCmd}`);
      }
      this.isThrottled = true;
      console.log(`📡 Network Condition Applied: ${netemCmd}`);
    } catch (error: any) {
      console.error(`❌ TC Error: ${error.message}. Ensure you have sudo/CAP_NET_ADMIN.`);
    }
  }

  /**
   * Utility for a clean "Turn off everything"
   */
  shutdown() {
    this.apply('SHUTDOWN');
  }

  /**
   * Resets the interface to normal (Deletes the qdisc)
   */
  reset() {
    try {
      execSync(`sudo tc qdisc del dev ${this.interface} root`);
      this.isThrottled = false;
      console.log('✅ Network restored to hardware default.');
    } catch (e) {
      // Silent fail if already deleted
    }
  }

  /**
   * Critical: If the Node process is killed (Ctrl+C), restore the network!
   */
  private setupEmergencyCleanup() {
    const cleanup = () => {
      if (this.isThrottled) {
        console.log('\n🚨 Emergency Network Reset...');
        try { execSync(`sudo tc qdisc del dev ${this.interface} root`); } catch { }
        process.exit();
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}
