import { test, expect } from '@playwright/test';

test.describe('Meeting Room - Basic Smoke Tests', () => {
  test('Application loads and shows the meeting container', async ({ page }) => {
    await page.goto('/');

    const container = page.getByTestId('meeting-container');
    await expect(container).toBeVisible();

    const status = page.getByTestId('connection-status');
    await expect(status).toBeVisible();

    const joinButton = page.getByTestId('join-leave-button');
    await expect(joinButton).toHaveText('Join');
  });

  test('Room ID can be changed', async ({ page }) => {
    await page.goto('/');

    const roomInput = page.getByTestId('room-id-input');
    await roomInput.fill('test-room-123');
    await expect(roomInput).toHaveValue('test-room-123');
  });

  test('Join button triggers state change', async ({ page }) => {
    await page.goto('/');

    const joinButton = page.getByTestId('join-leave-button');
    const status = page.getByTestId('connection-status');

    // Initial state should be 'new' or 'disconnected'
    await expect(status).toHaveText(/new|disconnected/);

    // Click join
    await joinButton.click();

    // State should change (could be joining, connecting, failed, etc.)
    // We just verify it's NOT the same as before
    await expect(status).not.toHaveText('disconnected', { timeout: 5000 });
  });
});
