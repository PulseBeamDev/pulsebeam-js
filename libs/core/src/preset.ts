/**
 * High-level intent for video quality.
 */
export interface VideoPreset {
  layers: 1 | 2 | 3;
  mode: "detail" | "motion";
  maxFps: number;
  baseBitrate: number;
}

/**
 * Standard defaults for common use cases.
 */
export const PRESETS: Record<"camera" | "screen", VideoPreset> = {
  camera: {
    layers: 3,
    mode: "motion",
    maxFps: 30,
    baseBitrate: 1_500_000 // 1.5 Mbps for 720p/30
  },
  screen: {
    layers: 3,
    mode: "detail", // Forces clarity over smoothness
    maxFps: 5,        // Drastically reduced for text sharpness
    baseBitrate: 3_500_000 // 3.5 Mbps for crystal clear 1080p+ at low FPS
  },
};

/**
 * Internal mapper to translate our abstraction into WebRTC SendParameters.
 */
export function mapPresetToInternal(preset: VideoPreset) {
  const rids = ["q", "h", "f"];
  const scales = preset.layers === 3 ? [4, 2, 1] : preset.layers === 2 ? [2, 1] : [1];

  const encodings = scales.map((scale, i) => {
    // Calculate bitrate based on pixel area (inverse square law)
    // A scale of 2 means 1/4 the pixels, so we give it 1/4 the bitrate.
    const areaReduction = Math.pow(scale, 2);
    const calculatedBitrate = Math.floor(preset.baseBitrate / areaReduction);

    return {
      rid: rids[3 - preset.layers + i],
      scaleResolutionDownBy: scale,
      maxBitrate: calculatedBitrate,
      maxFramerate: preset.maxFps,
      active: true,
      // For "detail" mode, we increase priority to prevent the browser from dropping it
      priority: preset.mode === "detail" ? "high" : "low"
    };
  });

  return {
    encodings,
    degradationPreference: preset.mode === "detail" ? "maintain-resolution" : "balanced",
    contentHint: preset.mode === "detail" ? "text" : "motion",
  };
}
