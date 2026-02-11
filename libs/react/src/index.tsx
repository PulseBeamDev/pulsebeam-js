import { useMemo, useEffect, useRef } from "react";
import { useStore } from "@nanostores/react";
import {
  // createDeviceManager,
  // createDisplayManager,
  VideoBinder,
  AudioBinder,
  BrowserAdapter,
  Participant,
  type ParticipantConfig
} from "@pulsebeam/web";
export * from "@pulsebeam/web";

/**
 * Merges a class instance with its internal nanostore state.
 * Methods from the class are available via the prototype.
 */
function useClassStore<T extends { state: any }>(instance: T): T & ReturnType<typeof useStore<T["state"]>> {
  const state = useStore(instance.state);
  return useMemo(() => {
    return Object.assign(Object.create(instance), state);
  }, [state, instance]);
}

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

export const Video = ({ track, ...props }: any) => (
  <video ref={useBinder(track, VideoBinder)} autoPlay playsInline muted {...props} />
);

export const Audio = ({ track, ...props }: any) => (
  <audio ref={useBinder(track, AudioBinder)} autoPlay {...props} />
);

export function useParticipant(config: ParticipantConfig) {
  const participant = useMemo(() => new Participant(BrowserAdapter, config), []);
  return useClassStore(participant);
}

// export function useDeviceManager() {
//   const dm = useMemo(() => createDeviceManager(BrowserAdapter), []);
//   return useClassStore(dm);
// }
//
// export function useDisplayManager() {
//   const dm = useMemo(() => createDisplayManager(BrowserAdapter), []);
//   return useClassStore(dm);
// }
