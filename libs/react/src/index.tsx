import { useMemo, useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import {
  createParticipant,
  createDeviceManager,
  createDisplayManager,
  VideoBinder,
  AudioBinder,
  type ParticipantConfig,
  type ParticipantManager,
  type RemoteVideoTrack,
  PAUSED_PLACEHOLDER_SVG,
} from "@pulsebeam/web";

export * from "@pulsebeam/web";

const useBinder = (track: any, Binder: any) => {
  const ref = useRef<any>(null);
  useEffect(() => {
    if (!ref.current || !track) return;
    const b = new Binder(ref.current, track);
    b.mount();
    return () => b.unmount();
  }, [track, Binder]);
  return ref;
};

export const Video = ({ track, className, style, ...props }: { track: RemoteVideoTrack; className?: string; style?: React.CSSProperties;[key: string]: any }) => {
  const [paused, setPaused] = useState<boolean>(track?.paused ?? true);

  useEffect(() => {
    if (!track) return;
    setPaused(track.paused);
    track.onPausedChange = (p: boolean) => setPaused(p);
    return () => { track.onPausedChange = undefined; };
  }, [track]);

  const ref = useBinder(track, VideoBinder);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style
      }}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        {...props}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: paused ? 0 : 1,
          transition: "opacity 120ms ease"
        }}
      />

      {paused && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          pointerEvents: "none",
          zIndex: 1, // Ensure it sits above the video
        }}>
          <img
            src={PAUSED_PLACEHOLDER_SVG}
            alt="Paused placeholder"
            aria-hidden="true"
            style={{
              height: "100%",
              opacity: 0.5
            }}
          />
        </div>
      )}
    </div>
  );
};

export const Audio = ({ track, ...props }: any) => (
  <audio ref={useBinder(track, AudioBinder)} autoPlay {...props} />
);

export function useParticipant(config: ParticipantConfig) {
  const $participant: ParticipantManager = useMemo(() => createParticipant(config), []);

  useEffect(() => {
    $participant.value?.reset(config, false);
  }, [config]);

  return useStore($participant);
}

export function useDeviceManager() {
  const $dm = useMemo(() => createDeviceManager(), []);
  return useStore($dm);
}

export function useDisplayManager() {
  const $dm = useMemo(() => createDisplayManager(), []);
  return useStore($dm);
}
