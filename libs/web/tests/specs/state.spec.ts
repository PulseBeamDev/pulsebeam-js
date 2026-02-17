import { test, expect, TEST_TIMEOUTS, CONNECTION_STATES } from '../fixtures';
import fc from 'fast-check';
import type { ParticipantDriver } from '../utils/participant-driver';

const JOIN_TIMEOUT = TEST_TIMEOUTS.CONNECTION;
const TOGGLE_TIMEOUT = TEST_TIMEOUTS.STATE_CHANGE;

function matchesConnectionState(state: string) {
  return CONNECTION_STATES.includes(state as (typeof CONNECTION_STATES)[number]);
}

function oppositeVideoLabel(label: string) {
  return label === 'Mute Video' ? 'Unmute Video' : 'Mute Video';
}

function oppositeAudioLabel(label: string) {
  return label === 'Mute Audio' ? 'Unmute Audio' : 'Mute Audio';
}

async function assertMuteConsistency(driver: ParticipantDriver) {
  const videoLabel = await driver.getVideoToggleLabel();
  const audioLabel = await driver.getAudioToggleLabel();
  const videoMutedText = (await driver.videoMutedState.textContent())?.trim() ?? '';
  const audioMutedText = (await driver.audioMutedState.textContent())?.trim() ?? '';

  if (videoLabel === 'Mute Video') {
    expect(videoMutedText).toBe('false');
  }
  if (videoLabel === 'Unmute Video') {
    expect(videoMutedText).toBe('true');
  }

  if (audioLabel === 'Mute Audio') {
    expect(audioMutedText).toBe('false');
  }
  if (audioLabel === 'Unmute Audio') {
    expect(audioMutedText).toBe('true');
  }
}

test.describe('State Synchronization', () => {
  test('rapid UI toggles keep state consistent', async ({ driver }) => {
    await driver.join();
    await driver.waitForConnectionState(/connecting|connected|failed/, JOIN_TIMEOUT);

    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom<'video' | 'audio'>('video', 'audio'), {
        minLength: 6,
        maxLength: 18,
      }), async toggles => {
        for (const toggle of toggles) {
          if (toggle === 'video') {
            const before = await driver.getVideoToggleLabel();
            await driver.toggleVideo();
            await expect
              .poll(async () => driver.getVideoToggleLabel(), { timeout: TOGGLE_TIMEOUT })
              .toBe(oppositeVideoLabel(before));
          } else {
            const before = await driver.getAudioToggleLabel();
            await driver.toggleAudio();
            await expect
              .poll(async () => driver.getAudioToggleLabel(), { timeout: TOGGLE_TIMEOUT })
              .toBe(oppositeAudioLabel(before));
          }

          await assertMuteConsistency(driver);
          const stateText = await driver.getConnectionStateText();
          expect(matchesConnectionState(stateText)).toBe(true);
        }
      }),
      { numRuns: process.env.CI ? 8 : 12 }
    );
  });
});
