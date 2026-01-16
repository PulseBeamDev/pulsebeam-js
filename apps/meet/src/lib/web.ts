import type { PlatformAdapter, Slot, ParticipantConfig } from "@pulsebeam/core";
export type * from "@pulsebeam/core";
export { Slot, ParticipantEvent } from "@pulsebeam/core";
import { Participant as CoreParticipant } from "@pulsebeam/core";

export const BrowserAdapter: PlatformAdapter = {
  RTCPeerConnection: globalThis.RTCPeerConnection.bind(globalThis),
  MediaStream: globalThis.MediaStream.bind(globalThis),
  fetch: globalThis.fetch.bind(globalThis),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  mediaDevices: globalThis.navigator.mediaDevices,
};


/**
 * A Session pre-configured for the Browser.
 * Usage: const session = new WebSession({ ... });
 */
export class Participant extends CoreParticipant {
  constructor(config: ParticipantConfig) {
    super(
      BrowserAdapter,
      config,
    );
  }
}

export class VideoBinder {
  private el: HTMLVideoElement;
  private slot: Slot;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  public onAutoplayFailed?: () => void;

  constructor(el: HTMLVideoElement, slot: Slot) {
    this.el = el;
    this.slot = slot;
  }

  mount() {
    if (!this.el || !this.slot) return;

    this.el.srcObject = this.slot.stream;

    this.el.playsInline = true; // Required for iOS Safari
    this.el.autoplay = true;
    this.el.muted = true; // Default to muted to allow autoplay

    this.el.play().catch((e) => {
      console.warn("[VideoBinder] Autoplay blocked:", e);
      if (this.onAutoplayFailed) this.onAutoplayFailed();
    });

    this.startObserving();
  }

  unmount() {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();

    if (this.el) {
      this.el.srcObject = null;
    }
  }

  /**
   * Helper to switch tracks without destroying the binder
   * (e.g., when screen share replaces camera)
   */
  update(newSlot: Slot) {
    if (this.slot === newSlot) return;

    this.slot = newSlot;

    // Re-assign stream
    if (this.el) {
      this.el.srcObject = this.slot.stream;
      this.el.play().catch(() => { });
    }
  }

  private startObserving() {
    // A. ResizeObserver: Update Core with exact pixel dimensions
    // This drives the Simulcast logic (High vs Low Res)
    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      // contentRect gives the actual size of the video element in pixels
      const { height } = entry.contentRect;

      // Tell Core the new height
      this.slot.setHeight(height);
    });
    this.resizeObserver.observe(this.el);

    // B. IntersectionObserver: Pause stream if scrolled out of view
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const isVisible = entries[0].isIntersecting;

      if (!isVisible) {
        // 0 height tells Core to pause/unsubscribe
        this.slot.setHeight(0);
      } else {
        // Restore height when visible
        const rect = this.el.getBoundingClientRect();
        this.slot.setHeight(rect.height);
      }
    });
    this.intersectionObserver.observe(this.el);
  }
}
