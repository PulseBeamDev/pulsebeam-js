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
  /**
   * Temporal layers per spatial encoding (H.264 `L1T{n}` scalability).
   *
   * Each temporal layer roughly doubles the frame rate: `L1T3` sends the base at
   * `maxFps/4`, then `maxFps/2`, then `maxFps`. libwebrtc encodes these for H.264
   * and attaches the Dependency Descriptor, which lets the SFU shed frame rate
   * one temporal step at a time under congestion — far finer than dropping a whole
   * simulcast layer. `1` disables temporal scalability.
   */
  temporalLayers: 1 | 2 | 3;
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
    // Camera/motion benefits most from smooth frame-rate adaptation: L1T3 gives
    // the SFU 30/15/7.5fps temporal steps to shed under congestion.
    temporalLayers: 3,
  },
  detail: {
    layers: 2,
    mode: "detail",
    minFps: 5,
    // Static screen content rarely needs 30fps; capping lower frees up
    // bitrate budget for resolution/quality instead.
    maxFps: 15,
    baseBitrate: 2_500_000,
    // Matches the transport's fixed L1T3 (scalabilityMode is set at addTransceiver,
    // not per preset). Screen at 15fps then sheds to 7.5/3.75fps under congestion.
    temporalLayers: 3,
  },
};

export const SCREEN_SHARE_MIN_FPS = 2;

/**
 * Internal mapper to translate our abstraction into WebRTC SendParameters.
 */
export function mapPresetToInternal(preset: VideoPreset) {
  // The transceiver is always negotiated with all 3 rids
  // (see Transport's addTransceiver calls) and WebRTC does not allow the
  // number or order of encodings to change after negotiation - only which
  // ones are `active`. So we always emit exactly 3, correctly ordered
  // low-to-high (ascending resolution, descending scaleResolutionDownBy) to
  // match the browser/W3C webrtc-svc convention, and use `active` to hide
  // layers beyond preset.layers instead of omitting them. Both modes use
  // real spatial simulcast (q/h/f at quarter/half/full resolution) - an
  // inactive-vs-active layer at the *same* resolution as another active
  // layer would cost a whole extra full-resolution encoder for no
  // bandwidth benefit. Detail additionally ramps frame rate per layer
  // since static screen content rarely needs full fps at every layer.
  const detailMode = preset.mode === "detail";
  const middleFramerate = detailMode && preset.layers === 2
    ? preset.minFps
    : Math.max(preset.minFps, Math.round(preset.maxFps / 2));
  const LAYERS = [
    { rid: "q", scale: 4, weight: 0.15, detailFramerate: preset.minFps },
    { rid: "h", scale: 2, weight: 0.35, detailFramerate: middleFramerate },
    { rid: "f", scale: 1, weight: 1.0, detailFramerate: preset.maxFps },
  ] as const;

  // Temporal scalability per spatial encoding. H.264 supports L1T1/L1T2/L1T3;
  // libwebrtc attaches the Dependency Descriptor so the SFU can shed temporal
  // layers (frame rate) within a simulcast layer instead of only between layers.
  const TEMPORAL_MODE = { 1: "L1T1", 2: "L1T2", 3: "L1T3" } as const;
  const scalabilityMode = TEMPORAL_MODE[preset.temporalLayers];

  const encodings = LAYERS.map(({ rid, scale, weight, detailFramerate }, i) => {
    const calculatedBitrate = Math.floor(preset.baseBitrate * weight);
    // Layers are ordered low-to-high, but `preset.layers` counts down from the
    // highest quality, so activation counts from the end of the array.
    const rankFromHighest = LAYERS.length - 1 - i;

    return {
      rid,
      scaleResolutionDownBy: scale,
      maxBitrate: calculatedBitrate,
      maxFramerate: detailMode ? detailFramerate : preset.maxFps,
      scalabilityMode,
      active: rankFromHighest < preset.layers,
    } satisfies RTCRtpEncodingParameters;
  });

  return {
    encodings,
    // detail favors legibility (resolution) over smoothness under congestion;
    // motion favors smoothness (framerate) since blur matters less for faces/movement.
    degradationPreference: preset.mode === "detail" ? "maintain-resolution" : "maintain-framerate",
    contentHint: preset.mode === "detail" ? "text" : "motion",
  };
}
