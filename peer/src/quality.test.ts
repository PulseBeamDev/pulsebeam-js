import { describe, expect, it } from "vitest";
import {
  calculateWebRTCQuality,
  ChannelStats,
  WebRTCStats,
} from "./quality.ts";

// Helper function to create dummy stats
function createChannelStats(
  partialStats: Partial<ChannelStats> = {},
): ChannelStats {
  return {
    rttMs: 50,
    jitterMs: 5,
    packetLossPercent: 0,
    availableOutgoingBitrateKbps: 1000,
    frameRate: 30,
    resolution: { width: 1280, height: 720 },
    freezeCount: 0,
    audioLevelVariance: 0.1,
    messagesSent: 1000,
    messagesReceived: 1000,
    messagesLost: 0,
    ...partialStats,
  };
}

describe("calculateWebRTCQuality", () => {
  it("calculates quality correctly for valid stats", () => {
    const stats: WebRTCStats = {
      audio: [createChannelStats()],
      video: [createChannelStats()],
      data: [createChannelStats()],
    };

    const quality = calculateWebRTCQuality(stats);

    // Check that the quality is a valid number between 0 and 100
    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(100);
  });

  it("returns 100 for empty stats", () => {
    const stats: WebRTCStats = {
      audio: [],
      video: [],
      data: [],
    };

    const quality = calculateWebRTCQuality(stats);

    expect(quality).toBe(100);
  });

  it("handles stats with extreme values correctly", () => {
    const extremeStats: WebRTCStats = {
      audio: [createChannelStats({ rttMs: 500, packetLossPercent: 50 })],
      video: [
        createChannelStats({
          frameRate: 120,
          availableOutgoingBitrateKbps: 3000,
        }),
      ],
      data: [createChannelStats({ messagesLost: 10 })],
    };

    const quality = calculateWebRTCQuality(extremeStats);

    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(100);
  });

  it("gives a lower score for high packet loss", () => {
    const highPacketLossStats: WebRTCStats = {
      audio: [createChannelStats({ packetLossPercent: 10 })],
      video: [createChannelStats()],
      data: [createChannelStats()],
    };

    const quality = calculateWebRTCQuality(highPacketLossStats);

    expect(quality).toBeLessThan(100);
  });

  it("gives a higher score for better frame rates", () => {
    const highFrameRateStats: WebRTCStats = {
      audio: [createChannelStats()],
      video: [createChannelStats({ frameRate: 60 })],
      data: [createChannelStats()],
    };

    const quality = calculateWebRTCQuality(highFrameRateStats);

    expect(quality).toBeGreaterThan(80);
  });

  it("handles stats with missing fields gracefully", () => {
    const missingFieldStats: WebRTCStats = {
      audio: [createChannelStats({ rttMs: undefined })],
      video: [createChannelStats({ resolution: undefined })],
      data: [createChannelStats({ messagesSent: undefined })],
    };

    const quality = calculateWebRTCQuality(missingFieldStats);

    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(100);
  });
});
