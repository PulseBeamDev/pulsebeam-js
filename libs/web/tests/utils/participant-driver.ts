import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../fixtures/test-data';

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

  /**
   * Get internal test state exposed by the test app
   */
  async getTestState() {
    return this.page.evaluate(() => (window as any).__testState);
  }

  /**
   * Helper to perform actions on a specific participant track container
   */
  async getTrackContainer(participantId: string) {
    return this.page.locator(`[data-participant-id="${participantId}"]`);
  }
}
