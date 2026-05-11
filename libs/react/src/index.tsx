import { useMemo, useEffect, useRef, useState } from "react";
import type { CSSProperties, VideoHTMLAttributes } from "react";
import { useStore } from "@nanostores/react";
import {
  createParticipant,
  createDeviceManager,
  createDisplayManager,
  VideoBinder,
  AudioBinder,
  PAUSED_PLACEHOLDER_SVG,
  type ParticipantSnapshot,
  type ParticipantManager,
  type DeviceSnapshot,
  type DisplaySnapshot,
  type ParticipantConfig,
} from "@pulsebeam/web";

export * from "@pulsebeam/web";
export type {
  ParticipantConfig,
  ParticipantSnapshot,
  DeviceSnapshot,
  DisplaySnapshot,
} from "@pulsebeam/web";
type RemoteVideoTrack = ParticipantSnapshot["videoTracks"][number];

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


export interface VideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
  track: RemoteVideoTrack;
  className?: string;
  style?: CSSProperties;
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
          opacity: paused ? 0 : 1,
        }}
      />

      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1a1a",
        pointerEvents: "none",
        opacity: paused ? 1 : 0,
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
    </div>
  );
};

export const Audio = ({ track, ...props }: any) => (
  <audio ref={useBinder(track, AudioBinder)} autoPlay {...props} />
);

export function useParticipant(config: ParticipantConfig): ParticipantSnapshot {
  const $participant: ParticipantManager = useMemo(() => createParticipant(config), []);

  useEffect(() => {
    $participant.value?.reset(config, false);
  }, [config]);

  return useStore($participant);
}

export function useDeviceManager(): DeviceSnapshot {
  const $dm = useMemo(() => createDeviceManager(), []);
  return useStore($dm);
}

export function useDisplayManager(): DisplaySnapshot {
  const $dm = useMemo(() => createDisplayManager(), []);
  return useStore($dm);
}
