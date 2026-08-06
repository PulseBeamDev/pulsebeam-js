import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../fixtures/test-data';
import type { QoeSnapshot } from './qoe';

export interface HarnessState {
  connectionState: string;
  videoTracks: Array<{ id: string; participantId: string; height: number; paused: boolean }>;
  audioTracks: Array<{ id: string }>;
  videoMuted: boolean;
  audioMuted: boolean;
}

/**
 * Imperative driver over the `window.__pb` harness API — the stable, UI-free
 * contract for QoE tests. Every method is a thin `page.evaluate` into the SDK, so
 * tests never touch demo markup and never break on UI churn.
 */
export class SdkDriver {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.page.on('console', (msg) => console.log(`[Browser ${msg.type()}] ${msg.text()}`));
    this.page.on('pageerror', (err) => console.log(`[Browser pageerror] ${err.message}`));
  }

  async goto() {
    await this.page.goto('/tests/fixtures/test-page.html');
    await this.page.waitForFunction(() => !!(window as any).__pb, undefined, { timeout: 15_000 });
  }

  async create(config: Record<string, unknown> = {}) {
    await this.page.evaluate((c) => (window as any).__pb.create(c), config);
  }

  async connect(room: string) {
    await this.page.evaluate((r) => (window as any).__pb.connect(r), room);
  }

  async publish(opts: { video?: boolean; audio?: boolean } = { video: true, audio: true }) {
    await this.page.evaluate((o) => (window as any).__pb.publish(o), opts);
  }

  async unpublish() {
    await this.page.evaluate(() => (window as any).__pb.unpublish());
  }

  async mute(opts: { video?: boolean; audio?: boolean }) {
    await this.page.evaluate((o) => (window as any).__pb.mute(o), opts);
  }

  async subscribe(
    participantId: string,
    opts: { height?: number; minHeight?: number; priority?: number } = {},
  ): Promise<number> {
    return this.page.evaluate(
      ([id, o]) => (window as any).__pb.subscribe(id, o),
      [participantId, opts] as const,
    );
  }

  async close() {
    await this.page.evaluate(() => (window as any).__pb.close());
  }

  async getState(): Promise<HarnessState> {
    return this.page.evaluate(() => (window as any).__pb.getState());
  }

  async getStats(): Promise<QoeSnapshot> {
    return this.page.evaluate(() => (window as any).__pb.getStats());
  }

  async declareTopic(name: string, mode: 'latest' | 'ordered') {
    await this.page.evaluate(
      ([n, m]) => (window as any).__pb.declareTopic(n, m),
      [name, mode] as const,
    );
  }

  async publishData(name: string, payload: number[]) {
    await this.page.evaluate(
      ([n, p]) => (window as any).__pb.publishData(n, p),
      [name, payload] as const,
    );
  }

  async getReceivedData(name: string): Promise<number[][]> {
    return this.page.evaluate((n) => (window as any).__pb.getReceivedData(n), name);
  }

  async clearReceivedData(name: string) {
    await this.page.evaluate((n) => (window as any).__pb.clearReceivedData(n), name);
  }
}

/**
 * High-level driver for participant interactions in vanilla TS E2E tests
 */
export class ParticipantDriver {
  readonly page: Page;
  readonly joinButton: Locator;
  readonly leaveButton: Locator;
  readonly roomInput: Locator;
  readonly connectionState: Locator;
  readonly videoGrid: Locator;
  readonly audioTracks: Locator;
  readonly toggleVideoButton: Locator;
  readonly toggleAudioButton: Locator;
  readonly shareScreenButton: Locator;
  readonly videoMutedState: Locator;
  readonly audioMutedState: Locator;
  readonly videoTrackCount: Locator;
  readonly audioTrackCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.page.on('console', msg => {
      console.log(`[Browser ${msg.type()}] ${msg.text()}`);
    });
    this.joinButton = page.getByTestId('join-button');
    this.leaveButton = page.getByTestId('leave-button');
    this.roomInput = page.getByTestId('room-input');
    this.connectionState = page.getByTestId('connection-state');
    this.videoGrid = page.getByTestId('video-grid');
    this.audioTracks = page.getByTestId('audio-tracks');
    this.toggleVideoButton = page.getByTestId('toggle-video-button');
    this.toggleAudioButton = page.getByTestId('toggle-audio-button');
    this.shareScreenButton = page.getByTestId('share-screen-button');
    this.videoMutedState = page.getByTestId('video-muted');
    this.audioMutedState = page.getByTestId('audio-muted');
    this.videoTrackCount = page.getByTestId('video-track-count');
    this.audioTrackCount = page.getByTestId('audio-track-count');
  }

  async goto() {
    // We serve the test-page.html via Vite
    await this.page.goto('/tests/fixtures/test-page.html');
    await expect(this.page.getByTestId('test-app')).toBeVisible();
  }

  async setRoomId(roomId: string) {
    await this.roomInput.fill(roomId);
  }

  async join() {
    await this.joinButton.click();
  }

  async leave() {
    await this.leaveButton.click();
  }

  async toggleVideo() {
    await this.toggleVideoButton.click();
  }

  async toggleAudio() {
    await this.toggleAudioButton.click();
  }

  async shareScreen() {
    await this.shareScreenButton.click();
  }

  async getConnectionStateText(): Promise<string> {
    const text = await this.connectionState.textContent();
    return (text ?? '').trim();
  }

  async isJoinVisible(): Promise<boolean> {
    return this.joinButton.isVisible();
  }

  async isLeaveVisible(): Promise<boolean> {
    return this.leaveButton.isVisible();
  }

  async isRoomInputEnabled(): Promise<boolean> {
    return this.roomInput.isEnabled();
  }

  async getVideoToggleLabel(): Promise<string> {
    const text = await this.toggleVideoButton.textContent();
    return (text ?? '').trim();
  }

  async getAudioToggleLabel(): Promise<string> {
    const text = await this.toggleAudioButton.textContent();
    return (text ?? '').trim();
  }

  async getVideoTrackCount(): Promise<number> {
    const text = await this.videoTrackCount.textContent();
    return Number(text ?? '0');
  }

  async getAudioTrackCount(): Promise<number> {
    const text = await this.audioTrackCount.textContent();
    return Number(text ?? '0');
  }

  async waitForConnectionState(state: string | RegExp, timeout: number = TEST_TIMEOUTS.CONNECTION) {
    await expect(this.connectionState).toHaveText(state, { timeout });
  }

  async expectConnectionState(state: string | RegExp) {
    await expect(this.connectionState).toHaveText(state);
  }

  async expectVideoTrackCount(count: number) {
    await expect(this.videoTrackCount).toHaveText(String(count), {
      timeout: TEST_TIMEOUTS.MEDIA_READY,
    });
  }

  async expectAudioTrackCount(count: number) {
    await expect(this.audioTrackCount).toHaveText(String(count), {
      timeout: TEST_TIMEOUTS.MEDIA_READY,
    });
  }

  async isVideoMuted(): Promise<boolean> {
    const text = await this.videoMutedState.textContent();
    return text === 'true';
  }

  async isAudioMuted(): Promise<boolean> {
    const text = await this.audioMutedState.textContent();
    return text === 'true';
  }

  async getTrackContainer(participantId: string) {
    return this.page.locator(`[data-participant-id="${participantId}"]`);
  }
}
