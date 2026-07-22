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
    { rid: "f", active: true },
    { rid: "h", active: true },
    { rid: "q", active: true },
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

    syncSenderState(videoSender, audioSender, desired as any);
    await vi.waitFor(() => expect(videoSender.replaceTrack).toHaveBeenCalledWith(desired.localStream.video!.track));
  });

  it("is a no-op once the sender already matches the desired track (idempotent)", () => {
    const videoSender = fakeSender();
    const audioSender = fakeSender();
    const desired = desiredState();

    // Simulate the sender already carrying the desired track.
    Object.defineProperty(videoSender, "track", { get: () => desired.localStream.video!.track });

    syncSenderState(videoSender, audioSender, desired as any);
    expect(videoSender.replaceTrack).not.toHaveBeenCalled();
  });

  it("self-heals: a failed replaceTrack (e.g. mid-renegotiation) succeeds on a later retry", async () => {
    // This is the core regression this test guards: a transient replaceTrack
    // rejection used to be silently swallowed with no retry path, leaving a
    // published screen share permanently un-sent. Participant now retries via
    // a periodic heartbeat that just calls syncSenderState again.
    let shouldFail = true;
    const videoSender = fakeSender({
      replaceTrack: async () => {
        if (shouldFail) throw new Error("InvalidStateError: mid-renegotiation");
      },
    });
    const audioSender = fakeSender();
    const desired = desiredState();

    syncSenderState(videoSender, audioSender, desired as any);
    await vi.waitFor(() => expect(videoSender.replaceTrack).toHaveBeenCalledTimes(1));
    expect(videoSender.track).toBeNull(); // failed - sender still not publishing

    // Heartbeat retry (Participant.scheduleSyncHeartbeat) just calls this again.
    shouldFail = false;
    syncSenderState(videoSender, audioSender, desired as any);
    await vi.waitFor(() => expect(videoSender.track).toBe(desired.localStream.video!.track));
  });

  it("activates only the encodings within the preset's layer count (screen share = detail, 2 layers)", () => {
    const videoSender = fakeSender();
    const audioSender = fakeSender();
    const desired = desiredState({ videoPreset: VIDEO_PRESETS.detail });

    syncSenderState(videoSender, audioSender, desired as any);

    const [params] = (videoSender.setParameters as any).mock.calls.at(-1);
    expect(params.encodings.map((e: any) => e.active)).toEqual([true, true, false]);
  });

  it("deactivates all encodings when the local video is muted", () => {
    const videoSender = fakeSender();
    const audioSender = fakeSender();
    const desired = desiredState({ videoMuted: true });

    // Sender already has the track so only encoding params are reconciled.
    Object.defineProperty(videoSender, "track", { get: () => desired.localStream.video!.track });

    syncSenderState(videoSender, audioSender, desired as any);

    const [params] = (videoSender.setParameters as any).mock.calls.at(-1);
    expect(params.encodings.every((e: any) => e.active === false)).toBe(true);
  });

  it("tolerates a sender that isn't negotiated yet (getParameters throws) without throwing", () => {
    const videoSender = {
      track: null,
      replaceTrack: vi.fn().mockResolvedValue(undefined),
      getParameters: () => { throw new Error("not negotiated"); },
      setParameters: vi.fn(),
    } as unknown as RTCRtpSender;
    const audioSender = fakeSender();
    const desired = desiredState();

    expect(() => syncSenderState(videoSender, audioSender, desired as any)).not.toThrow();
  });
});
