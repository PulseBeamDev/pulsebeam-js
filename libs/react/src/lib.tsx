import { useMemo, useEffect, useRef } from "react";
import { useStore } from "@nanostores/react";
import {
  createParticipant,
  createDeviceManager,
  createDisplayManager,
  VideoBinder,
  AudioBinder,
  type ParticipantConfig,
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

export const Video = ({ track, ...props }: any) => <video ref={useBinder(track, VideoBinder)} autoPlay playsInline muted {...props} />;
export const Audio = ({ track, ...props }: any) => <audio ref={useBinder(track, AudioBinder)} autoPlay {...props} />;

export function useParticipant(config: ParticipantConfig) {
  const $participant = useMemo(() => createParticipant(config), []);
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
