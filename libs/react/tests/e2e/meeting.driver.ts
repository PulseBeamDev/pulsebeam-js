import { Page, expect, Locator } from '@playwright/test';

export class MeetingDriver {
  readonly roomIdInput: Locator;
  readonly joinLeaveButton: Locator;
  readonly connectionStatus: Locator;
  readonly camMuteButton: Locator;
  readonly micMuteButton: Locator;
  readonly screenShareButton: Locator;
  readonly videoGrid: Locator;

  constructor(private page: Page) {
    this.roomIdInput = page.getByTestId('room-id-input');
    this.joinLeaveButton = page.getByTestId('join-leave-button');
    this.connectionStatus = page.getByTestId('connection-status');
    this.camMuteButton = page.getByTestId('cam-mute-button');
    this.micMuteButton = page.getByTestId('mic-mute-button');
    this.screenShareButton = page.getByTestId('screen-share-button');
    this.videoGrid = page.getByTestId('video-grid');
  }

  async open() {
    // Cache bust to ensure fresh load
    await this.page.goto(`/?t=${Date.now()}`, { waitUntil: 'networkidle' });
    const container = this.page.getByTestId('meeting-container');
    await expect(container).toBeVisible();

    const instanceId = await container.getAttribute('data-instance-id');
    console.log(`Driver: Opened instance ${instanceId}`);

    // If somehow it's already live (bleeding state?), force leave
    const isLive = await this.joinLeaveButton.getAttribute('data-live') === 'true';
    if (isLive) {
      console.warn(`Driver: Instance ${instanceId} was unexpectedly live, forcing leave.`);
      await this.joinLeaveButton.click();
      await expect(this.connectionStatus).toHaveText(/disconnected|closed/);
    }

    // Now ensure we are ready for the test
    await expect(this.joinLeaveButton).toHaveText('Join');
  }

  async setRoomId(id: string) {
    await this.roomIdInput.fill(id);
  }

  async join() {
    await expect(this.joinLeaveButton).toHaveText('Join');
    await this.joinLeaveButton.click();
  }

  async leave() {
    await expect(this.joinLeaveButton).toHaveText('Leave');
    await this.joinLeaveButton.click();
  }

  async muteCam() {
    await expect(this.camMuteButton).toHaveAttribute('data-muted', 'false');
    await this.camMuteButton.click();
  }

  async unmuteCam() {
    await expect(this.camMuteButton).toHaveAttribute('data-muted', 'true');
    await this.camMuteButton.click();
  }

  async muteMic() {
    await expect(this.micMuteButton).toHaveAttribute('data-muted', 'false');
    await this.micMuteButton.click();
  }

  async unmuteMic() {
    await expect(this.micMuteButton).toHaveAttribute('data-muted', 'true');
    await this.micMuteButton.click();
  }

  async expectStatus(expectedStatus: string | RegExp) {
    await expect(this.connectionStatus).toHaveText(expectedStatus);
  }

  async expectCamMuted(expectedMuted: boolean) {
    await expect(this.camMuteButton).toHaveAttribute('data-muted', expectedMuted.toString());
  }

  async expectMicMuted(expectedMuted: boolean) {
    await expect(this.micMuteButton).toHaveAttribute('data-muted', expectedMuted.toString());
  }

  async expectVideoGridToBeVisible() {
    await expect(this.videoGrid).toBeVisible();
  }
}
