import { describe, expect, it, vi } from "vitest";
import { syncSenderState } from "../src/participant";
import { VIDEO_PRESETS, AUDIO_PRESETS } from "../src/preset";

function fakeTrack(kind: "video" | "audio" = "video"): MediaStreamTrack {
  return {
    id: `${kind}-${Math.random()}`,
    kind,
    label: "",
    enabled: true,
    muted: false,
    readyState: "live",
    contentHint: "",
    stop: vi.fn(),
    getSettings: () => ({}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    clone() { return this; },
    onended: null,
    onmute: null,
    onunmute: null,
  } as unknown as MediaStreamTrack;
}

function fakeSender(opts: { replaceTrack?: () => Promise<void> } = {}): RTCRtpSender {
  let track: MediaStreamTrack | null = null;
  const encodings = [
    { rid: "f", active: true, scaleResolutionDownBy: undefined, maxBitrate: undefined, maxFramerate: undefined },
    { rid: "h", active: true, scaleResolutionDownBy: undefined, maxBitrate: undefined, maxFramerate: undefined },
    { rid: "q", active: true, scaleResolutionDownBy: undefined, maxBitrate: undefined, maxFramerate: undefined },
  ];
  return {
    get track() { return track; },
    replaceTrack: vi.fn(async (t: MediaStreamTrack | null) => {
      if (opts.replaceTrack) await opts.replaceTrack();
      track = t;
    }),
    getParameters: () => ({ encodings, transactionId: "1", degradationPreference: undefined }),
    setParameters: vi.fn(async () => { }),
  } as unknown as RTCRtpSender;
}

function desiredState(overrides: Partial<{
  stream: MediaStream | null;
  videoMuted: boolean;
  videoPreset: typeof VIDEO_PRESETS["detail"];
}> = {}) {
  const videoTrack = fakeTrack("video");
  return {
    localStream: {
      video: { track: videoTrack, muted: overrides.videoMuted ?? false },
      audio: null,
    },
    videoPreset: overrides.videoPreset ?? VIDEO_PRESETS.detail,
    audioPreset: AUDIO_PRESETS.music,
  };
}

describe("syncSenderState", () => {
  it("publishes a new track by calling replaceTrack on the video sender", async () => {
    const videoSender = fakeSender();
    const audioSender = fakeSender();
    const desired = desiredState();

    await syncSenderState(videoSender, audioSender, desired as any);
    expect(videoSender.replaceTrack).toHaveBeenCalledWith(desired.localStream.video!.track);
  });

  it("is a no-op once the sender already matches the desired track (idempotent)", async () => {
    const videoSender = fakeSender();
    const audioSender = fakeSender();
    const desired = desiredState();

    // Simulate the sender already carrying the desired track.
    Object.defineProperty(videoSender, "track", { get: () => desired.localStream.video!.track });

    await syncSenderState(videoSender, audioSender, desired as any);
    expect(videoSender.replaceTrack).not.toHaveBeenCalled();
  });

  it("makes one publish attempt when replaceTrack fails", async () => {
    const videoSender = fakeSender({
      replaceTrack: async () => {
        throw new Error("InvalidStateError: mid-negotiation");
      },
    });
    const audioSender = fakeSender();
    const desired = desiredState();

    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await syncSenderState(videoSender, audioSender, desired as any);
    warning.mockRestore();

    expect(videoSender.replaceTrack).toHaveBeenCalledTimes(1);
    expect(videoSender.track).toBeNull();
  });

  it("activates two native-resolution temporal encodings in the detail preset", async () => {
    const videoSender = fakeSender();
    const audioSender = fakeSender();
    const desired = desiredState({ videoPreset: VIDEO_PRESETS.detail });

    await syncSenderState(videoSender, audioSender, desired as any);

    const [params] = (videoSender.setParameters as any).mock.calls.at(-1);
    expect(params.encodings.map((e: any) => e.active)).toEqual([true, true, false]);
    expect(params.encodings.map((e: any) => e.scaleResolutionDownBy)).toEqual([1, 1, 1]);
    expect(params.encodings.map((e: any) => e.maxFramerate)).toEqual([15, 5, 5]);
  });

  it("keeps layer activity synchronized when the preset changes", async () => {
    const videoSender = fakeSender();
    const audioSender = fakeSender();
    const desired = desiredState({ videoPreset: VIDEO_PRESETS.motion });

    await syncSenderState(videoSender, audioSender, desired as any);
    let params = (videoSender.setParameters as any).mock.calls.at(-1)[0];
    expect(params.encodings.map((e: any) => e.active)).toEqual([true, true, true]);

    desired.videoPreset = VIDEO_PRESETS.detail;
    await syncSenderState(videoSender, audioSender, desired as any);
    params = (videoSender.setParameters as any).mock.calls.at(-1)[0];
    expect(params.encodings.map((e: any) => e.active)).toEqual([true, true, false]);

    desired.videoPreset = VIDEO_PRESETS.motion;
    await syncSenderState(videoSender, audioSender, desired as any);
    params = (videoSender.setParameters as any).mock.calls.at(-1)[0];
    expect(params.encodings.map((e: any) => e.active)).toEqual([true, true, true]);
  });

  it("deactivates all encodings when the local video is muted", async () => {
    const videoSender = fakeSender();
    const audioSender = fakeSender();
    const desired = desiredState({ videoMuted: true });

    // Sender already has the track so only encoding params are reconciled.
    Object.defineProperty(videoSender, "track", { get: () => desired.localStream.video!.track });

    await syncSenderState(videoSender, audioSender, desired as any);

    const [params] = (videoSender.setParameters as any).mock.calls.at(-1);
    expect(params.encodings.every((e: any) => e.active === false)).toBe(true);
  });

  it("tolerates a sender that isn't negotiated yet (getParameters throws) without throwing", async () => {
    const videoSender = {
      track: null,
      replaceTrack: vi.fn().mockResolvedValue(undefined),
      getParameters: () => { throw new Error("not negotiated"); },
      setParameters: vi.fn(),
    } as unknown as RTCRtpSender;
    const audioSender = fakeSender();
    const desired = desiredState();

    await expect(syncSenderState(videoSender, audioSender, desired as any)).resolves.toBeUndefined();
  });
});
