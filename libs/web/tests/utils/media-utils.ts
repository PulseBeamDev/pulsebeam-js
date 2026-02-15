import { Page, Locator } from '@playwright/test';

/**
 * Utilities for verifying media playback in vanilla TS tests
 */
export class MediaUtils {
    static async isVideoPlaying(videoElement: Locator): Promise<boolean> {
        return videoElement.evaluate((video: HTMLVideoElement) => {
            return !!(
                video.currentTime > 0 &&
                !video.paused &&
                !video.ended &&
                video.readyState > 2
            );
        });
    }

    static async getVideoDimensions(videoElement: Locator) {
        return videoElement.evaluate((video: HTMLVideoElement) => ({
            width: video.videoWidth,
            height: video.videoHeight,
        }));
    }

    static async getTrackStates(mediaElement: Locator) {
        return mediaElement.evaluate((el: HTMLMediaElement) => {
            const stream = el.srcObject as MediaStream;
            if (!stream) return { video: [], audio: [] };

            return {
                video: stream.getVideoTracks().map(t => ({
                    id: t.id,
                    enabled: t.enabled,
                    muted: t.muted,
                    readyState: t.readyState,
                })),
                audio: stream.getAudioTracks().map(t => ({
                    id: t.id,
                    enabled: t.enabled,
                    muted: t.muted,
                    readyState: t.readyState,
                })),
            };
        });
    }
}
