import type { Action } from 'svelte/action';
import { Slot, VideoBinder } from './web';
export * from "./web";

export const binder: Action<HTMLVideoElement | HTMLAudioElement, Slot> = (node, slot) => {
  let instance;

  if (node instanceof HTMLVideoElement) {
    instance = new VideoBinder(node, slot);
  } else {
    throw new Error("unimplemented");
  }
  instance.mount();
  return {
    update(newSlot) {
      instance.update(newSlot);
    },
    destroy() {
      instance.unmount();
    },
  };
};
