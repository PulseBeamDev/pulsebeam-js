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


export interface VideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  track: RemoteVideoTrack;
  className?: string;
  style?: React.CSSProperties;
}

export function Video(props: VideoProps) {
  const [paused, setPaused] = useState<boolean>(props.track ? props.track.paused : true);

  useEffect(() => {
    if (!props.track) return;
    setPaused(props.track.paused);
    props.track.onPausedChange = (p: boolean) => setPaused(p);
    return () => { props.track.onPausedChange = undefined; };
  }, [props.track]);

  const ref = useBinder(props.track, VideoBinder);

  return (
    <div
      className={props.className}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...props.style
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
