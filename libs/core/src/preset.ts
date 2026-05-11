export interface AudioPresetConfig {
  maxBitrate: number;
  contentHint: AudioPresetName;
  dtx: "enabled" | "disabled";
  stereo: boolean;
  // getUserMedia constraints — used when capturing the track
  constraints: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    channelCount?: number;
  };
}

export const AUDIO_PRESETS: Record<AudioPresetName, AudioPresetConfig> = {
  /**
   * Optimised for human voice in a call/conference context.
   * Browser pipeline cleans up noise, echo, gain.
   * Opus runs in SILK/hybrid mode — tuned for speech.
   */
  speech: {
    maxBitrate: 48_000,
    contentHint: "speech",
    dtx: "enabled",
    stereo: false,
    constraints: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
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
    dtx: "disabled",
    stereo: true,
    constraints: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    },
  },
};

export type AudioPreset = keyof typeof AUDIO_PRESETS;
export type AudioPresetName = "speech" | "music";

/**
 * High-level intent for video quality.
 */
export interface VideoPreset {
  layers: 1 | 2 | 3;
  mode: "detail" | "motion";
  minFps: number;
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
    minFps: 1,
    maxFps: 30,
    baseBitrate: 1_250_000,
  },
  detail: {
    layers: 3,
    mode: "detail",
    minFps: 2,
    maxFps: 30,
    baseBitrate: 2_500_000,
  },
};

export const SCREEN_SHARE_MIN_FPS = 2;

/**
 * Internal mapper to translate our abstraction into WebRTC SendParameters.
 */
export function mapPresetToInternal(preset: VideoPreset) {
  // Ordering here determines the highest quality first.
  // https://datatracker.ietf.org/doc/html/rfc8853#section-5.2
  // https://github.com/obsproject/obs-studio/pull/10885
  const allRids = ["f", "h", "q"];
  const allScales = [1, 2, 4];

  const rids = allRids.slice(0, preset.layers);
  const scales = allScales.slice(0, preset.layers);

  const maxFramerate = Math.max(preset.maxFps, preset.minFps);

  const encodings = scales.map((scale, i) => {
    // scale 1 (Full) gets 100% bitrate
    // scale 2 (Half) gets 35% bitrate
    // scale 4 (Quarter) gets 15% bitrate
    const weight = scale === 4 ? 0.15 : scale === 2 ? 0.35 : 1.0;
    const calculatedBitrate = Math.floor(preset.baseBitrate * weight);

    return {
      rid: rids[i],
      scaleResolutionDownBy: scale,
      maxBitrate: calculatedBitrate,
      maxFramerate,
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
