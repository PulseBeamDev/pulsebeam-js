import type { Action } from 'svelte/action';
import { RemoteTrack, VideoBinder } from './web';
export * from "./web";

export const binder: Action<HTMLVideoElement | HTMLAudioElement, RemoteTrack> = (node, track) => {
  let instance;

  if (node instanceof HTMLVideoElement) {
    instance = new VideoBinder(node, track);
  } else {
    throw new Error("unimplemented");
  }
  instance.mount();
  return {
    update(newTrack) {
      instance.update(newTrack);
    },
    destroy() {
      instance.unmount();
    },
  };
};
