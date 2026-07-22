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
    // 2 layers (max 2x downscale) instead of 3: screen-shared text/slides
    // become illegible at 1/4 resolution, so a constrained viewer is better
    // served by the half-res layer than a blurry quarter-res one.
    layers: 2,
    mode: "detail",
    minFps: 1,
    // Static screen content rarely needs 30fps; capping lower frees up
    // bitrate budget for resolution/quality instead.
    maxFps: 15,
    baseBitrate: 2_500_000,
  },
};

export const SCREEN_SHARE_MIN_FPS = 2;

/**
 * Internal mapper to translate our abstraction into WebRTC SendParameters.
 */
export function mapPresetToInternal(preset: VideoPreset) {
  // rid <-> scale is a fixed mapping (f=full, h=half, q=quarter), independent
  // of preset.layers. The transceiver is always negotiated with all 3 rids
  // (see Transport's addTransceiver calls) and WebRTC does not allow the
  // number or order of encodings to change after negotiation - only which
  // ones are `active`. So we always emit exactly 3, correctly ordered
  // (ascending scaleResolutionDownBy, as required by
  // https://datatracker.ietf.org/doc/html/rfc8853#section-5.2 and
  // https://github.com/obsproject/obs-studio/pull/10885), and use `active`
  // to hide layers beyond preset.layers instead of omitting them.
  const LAYERS = [
    { rid: "f", scale: 1, weight: 1.0 },
    { rid: "h", scale: 2, weight: 0.35 },
    { rid: "q", scale: 4, weight: 0.15 },
  ] as const;

  const maxFramerate = Math.max(preset.maxFps, preset.minFps);

  const encodings = LAYERS.map(({ rid, scale, weight }, i) => {
    const calculatedBitrate = Math.floor(preset.baseBitrate * weight);

    return {
      rid,
      scaleResolutionDownBy: scale,
      maxBitrate: calculatedBitrate,
      maxFramerate,
      active: i < preset.layers,
    } satisfies RTCRtpEncodingParameters;
  });

  return {
    encodings,
    // detail favors legibility (resolution) over smoothness under congestion;
    // motion favors smoothness (framerate) since blur matters less for faces/movement.
    degradationPreference: preset.mode === "detail" ? "maintain-resolution" : "balanced",
    contentHint: preset.mode === "detail" ? "text" : "motion",
  };
}
