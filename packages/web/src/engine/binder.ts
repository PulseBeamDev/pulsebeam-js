import type { VirtualSlot } from "@pulsebeam/core";

export class VideoBinder {
  private el: HTMLVideoElement;
  private slot: VirtualSlot;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  // Callback for UI to show "Click to Unmute" button if needed
  public onAutoplayFailed?: () => void;

  constructor(el: HTMLVideoElement, slot: VirtualSlot) {
    this.el = el;
    this.slot = slot;
  }

  mount() {
    // 1. Attach the stream from the VirtualSlot
    this.el.srcObject = this.slot.stream;
    this.el.playsInline = true;
    this.el.autoplay = true;

    // 2. Handle Autoplay Policy
    this.el.play().catch((e) => {
      console.warn("[VideoBinder] Autoplay failed", e);
      this.onAutoplayFailed?.();
    });

    // 3. Start Observing Dimensions & Visibility
    this.startObserving();
  }

  unmount() {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.el.srcObject = null;
  }

  private startObserving() {
    // A. ResizeObserver: Update core with exact pixel dimensions
    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      // Use contentRect for precise pixel size
      const { height, width } = entry.contentRect;

      // Heuristic: Use the larger dimension or strictly height?
      // Your core uses 'height' for priority, so let's pass that.
      // If the video is landscape in a small container, height matters for bitrate.
      this.slot.setHeight(height);
    });
    this.resizeObserver.observe(this.el);

    // B. IntersectionObserver: Pause (set height 0) if scrolled away
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const isVisible = entries[0].isIntersecting;

      if (!isVisible) {
        // Tell Core this slot is useless right now
        this.slot.setHeight(0);
      } else {
        // It will pick up height again on the next ResizeObserver trigger
        // or we can force a measure here if needed.
        const rect = this.el.getBoundingClientRect();
        this.slot.setHeight(rect.height);
      }
    });
    this.intersectionObserver.observe(this.el);
  }

  // Helper to swap slots (e.g. screen share takes over main view)
  update(newSlot: VirtualSlot) {
    if (this.slot === newSlot) return;
    this.slot = newSlot;
    // Re-mount stream
    this.el.srcObject = this.slot.stream;
    this.el.play().catch(() => { });
  }
}
