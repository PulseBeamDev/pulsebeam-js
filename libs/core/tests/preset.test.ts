import { describe, expect, it } from "vitest";
import { mapPresetToInternal, VIDEO_PRESETS } from "../src/preset";

describe("mapPresetToInternal", () => {
  it("always emits exactly 3 encodings, matching the 3 rids Transport hardcodes on the sender", () => {
    // Regression guard: Transport's RTCRtpTransceiver is always negotiated with
    // sendEncodings [q, h, f] and WebRTC does not allow adding/removing encodings
    // after negotiation. If this function ever returns fewer than 3 encodings again,
    // Transport.syncStream's rid lookup silently leaves the missing slot(s) at their
    // unconfigured (active, full-resolution, unbounded-bitrate) defaults forever -
    // exactly the bug that caused screen share to intermittently drop.
    for (const preset of Object.values(VIDEO_PRESETS)) {
      const { encodings } = mapPresetToInternal(preset);
      expect(encodings).toHaveLength(3);
      expect(encodings.map(e => e.rid)).toEqual(["q", "h", "f"]);
    }
  });

  it("marks only the last `layers` encodings active, highest quality first", () => {
    for (const layers of [1, 2, 3] as const) {
      const { encodings } = mapPresetToInternal({
        layers,
        mode: "detail",
        minFps: 1,
        maxFps: 15,
        baseBitrate: 1_600_000,
      });

      encodings.forEach((e, i) => {
        expect(e.active).toBe(encodings.length - 1 - i < layers);
      });
    }
  });

  it("never leaves an encoding without explicit scale/bitrate/framerate config, even when inactive", () => {
    // An inactive encoding with no scaleResolutionDownBy/maxBitrate would still
    // matter if something later flips `active` back on without recomputing config.
    const { encodings } = mapPresetToInternal(VIDEO_PRESETS.detail);
    for (const e of encodings) {
      expect(e.scaleResolutionDownBy).toBeGreaterThan(0);
      expect(e.maxBitrate).toBeGreaterThan(0);
      expect(e.maxFramerate).toBeGreaterThan(0);
    }
  });

  it("uses spatial layers at a consistent frame rate for motion", () => {
    const { encodings } = mapPresetToInternal(VIDEO_PRESETS.motion);
    const [q, h, f] = encodings;
    expect(encodings.map((encoding) => encoding.scaleResolutionDownBy)).toEqual([4, 2, 1]);
    expect(f!.maxBitrate!).toBeGreaterThan(h!.maxBitrate!);
    expect(h!.maxBitrate!).toBeGreaterThan(q!.maxBitrate!);
    expect(encodings.map((encoding) => encoding.maxFramerate)).toEqual([30, 30, 30]);
  });

  it("detail preset (used by screen share) favors resolution stability under congestion", () => {
    const { encodings, degradationPreference, contentHint } = mapPresetToInternal(VIDEO_PRESETS.detail);
    expect(degradationPreference).toBe("maintain-resolution");
    expect(contentHint).toBe("text");
    expect(encodings.map((encoding) => encoding.active)).toEqual([false, true, true]);
    expect(encodings.map((encoding) => encoding.scaleResolutionDownBy)).toEqual([4, 2, 1]);
    expect(encodings.map((encoding) => encoding.maxFramerate)).toEqual([5, 5, 15]);
  });
});
