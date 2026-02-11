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
    baseBitrate: 1_250_000
  },
  screen: {
    layers: 3,
    mode: "detail", // Forces clarity over smoothness
    maxFps: 30,
    baseBitrate: 2_500_000
  },
};

/**
 * Internal mapper to translate our abstraction into WebRTC SendParameters.
 */
export function mapPresetToInternal(preset: VideoPreset) {
  const rids = ["q", "h", "f"];
  const scales = [4, 2, 1];

  const encodings = scales.map((scale, i) => {
    const weight = scale === 4 ? 0.15 : scale === 2 ? 0.35 : 1.0;
    const calculatedBitrate = Math.floor(preset.baseBitrate * weight);

    return {
      rid: rids[i],
      scaleResolutionDownBy: scale,
      maxBitrate: calculatedBitrate,
      maxFramerate: preset.maxFps,
      active: true,
      priority: preset.mode === "detail" ? "high" : "low",
      networkPriority: preset.mode === "detail" ? "high" : "low"
    };
  });

  return {
    encodings,
    degradationPreference: preset.mode === "detail" ? "maintain-resolution" : "balanced",
    contentHint: preset.mode === "detail" ? "text" : "motion",
  };
}
