import type { ActionReturn } from "svelte/action";
import {
  createParticipantStore,
  VideoBinder,
  AudioBinder,
  RemoteVideoTrack,
  RemoteAudioTrack,
  type ParticipantConfig,
} from "@pulsebeam/web";
export * from "@pulsebeam/web";

/**
 * Svelte Action: use:attach={track}
 * Handles mounting/unmounting binders to DOM elements.
 */
export function attach(node: HTMLVideoElement, track: RemoteVideoTrack): ActionReturn<RemoteVideoTrack>;
export function attach(node: HTMLAudioElement, track: RemoteAudioTrack): ActionReturn<RemoteAudioTrack>;
export function attach(
  node: HTMLVideoElement | HTMLAudioElement,
  track: RemoteVideoTrack | RemoteAudioTrack
): ActionReturn<RemoteVideoTrack | RemoteAudioTrack> {
  let instance: VideoBinder | AudioBinder;

  if (node instanceof HTMLVideoElement && track instanceof RemoteVideoTrack) {
    instance = new VideoBinder(node, track);
  } else if (node instanceof HTMLAudioElement && track instanceof RemoteAudioTrack) {
    instance = new AudioBinder(node, track);
  } else {
    throw new Error("Mismatch: Element and Track types do not correspond");
  }

  instance.mount();

  return {
    update(newTrack) {
      // Binders have a built-in .update() to handle track swaps
      instance.update(newTrack as any);
    },
    destroy() {
      instance.unmount();
    },
  };
}

export function createParticipant(config: ParticipantConfig) {
  return createParticipantStore(config);
}
