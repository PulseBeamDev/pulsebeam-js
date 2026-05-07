export interface AudioPresetConfig {
  maxBitrate: number;
  contentHint: "speech" | "music";
  // getUserMedia constraints — used when capturing the track
  constraints: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
}

export const AUDIO_PRESETS = {
  /**
   * Optimised for human voice in a call/conference context.
   * Browser pipeline cleans up noise, echo, gain.
   * Opus runs in SILK/hybrid mode — tuned for speech.
   */
  voice: {
    maxBitrate: 48_000,
    contentHint: "speech",
    constraints: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },

  /**
   * Optimised for music, screen share audio, instruments, or
   * any full-spectrum content. Browser pipeline is bypassed.
   * Opus runs in full CELT mode — full 20Hz–20kHz.
   */
  music: {
    maxBitrate: 128_000,
    contentHint: "music",
    constraints: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  },
} as const satisfies Record<string, AudioPresetConfig>;

export type AudioPreset = keyof typeof AUDIO_PRESETS;

/**
 * High-level intent for video quality.
 */
export interface VideoPreset {
  layers: 1 | 2 | 3;
  mode: "detail" | "motion";
  maxFps: number;
  baseBitrate: number;
}

export type VideoPresetName = "motion" | "detail";

/**
 * Standard defaults for common use cases.
 */
export const VIDEO_PRESETS: Record<VideoPresetName, VideoPreset> = {
  motion: {
    layers: 3,
    mode: "motion",
    maxFps: 30,
    baseBitrate: 1_250_000,
  },
  detail: {
    layers: 3,
    mode: "detail",
    maxFps: 30,
    baseBitrate: 2_500_000,
  },
};

/**
 * Internal mapper to translate our abstraction into WebRTC SendParameters.
 */
export function mapPresetToInternal(preset: VideoPreset) {
  // Ordering here determines the highest quality first.
  // https://datatracker.ietf.org/doc/html/rfc8853#section-5.2
  // https://github.com/obsproject/obs-studio/pull/10885
  const rids = ["f", "h", "q"];
  const scales = [1, 2, 4];

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
