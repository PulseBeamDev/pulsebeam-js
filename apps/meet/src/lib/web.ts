import type { PlatformAdapter, ParticipantConfig, RemoteVideoTrack, RemoteAudioTrack } from "@pulsebeam/core";
export type * from "@pulsebeam/core";
export { RemoteAudioTrack, RemoteVideoTrack, ParticipantEvent } from "@pulsebeam/core";
import { Participant as CoreParticipant } from "@pulsebeam/core";
import adapter from "webrtc-adapter";

export const BrowserAdapter: PlatformAdapter = {
  RTCPeerConnection: globalThis.RTCPeerConnection,
  MediaStream: globalThis.MediaStream,
  getCapabilities: globalThis.RTCRtpSender.getCapabilities.bind(globalThis.RTCRtpSender),
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.body && ['POST', 'PUT', 'PATCH'].includes(init.method || '')) {
      try {
        const stream = new Blob([init.body as any]).stream();
        // https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream#browser_compatibility
        // GZIP is baseline widely available. We should update to zstd as it is widely available.
        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
        const compressedBody = await new Response(compressedStream).blob();

        return globalThis.fetch(input, {
          ...init,
          body: compressedBody,
          headers: {
            ...init.headers,
            'Content-Encoding': 'gzip',
          }
        });
      } catch (err) {
        console.error("Compression failed, falling back to uncompressed fetch", err);
        return globalThis.fetch(input, init);
      }
    }
    return globalThis.fetch(input, init);
  },
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  mediaDevices: globalThis.navigator.mediaDevices,
};


export class Participant extends CoreParticipant {
  constructor(config: ParticipantConfig) {
    if (adapter.browserDetails.browser == "firefox" && !!adapter.browserDetails.version && adapter.browserDetails.version < 146) {
      // TODO: this firefox requires at least 1 audio recv-only.. 
      config.audioSlots = Math.max(config.audioSlots, 1);
    }

    super(
      BrowserAdapter,
      config,
    );
  }
}

export class VideoBinder {
  private el: HTMLVideoElement;
  private track: RemoteVideoTrack;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  public onAutoplayFailed?: () => void;

  constructor(el: HTMLVideoElement, track: RemoteVideoTrack) {
    this.el = el;
    this.track = track;
  }

  mount() {
    if (!this.el || !this.track) return;

    this.el.srcObject = this.track.stream;

    this.el.playsInline = true; // Required for iOS Safari
    this.el.autoplay = true;
    this.el.muted = true; // Default to muted to allow autoplay
    this.el.controls = false;

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
  update(newTrack: RemoteVideoTrack) {
    if (this.track === newTrack) return;

    this.track = newTrack;

    // Re-assign stream
    if (this.el) {
      this.el.srcObject = this.track.stream;
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
      this.track.setHeight(height);
    });
    this.resizeObserver.observe(this.el);

    // B. IntersectionObserver: Pause stream if scrolled out of view
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const isVisible = entries[0].isIntersecting;

      if (!isVisible) {
        // 0 height tells Core to pause/unsubscribe
        this.track.setHeight(0);
      } else {
        // Restore height when visible
        const rect = this.el.getBoundingClientRect();
        this.track.setHeight(rect.height);
      }
    });
    this.intersectionObserver.observe(this.el);
  }
}

export class AudioBinder {
  private el: HTMLAudioElement;
  private track: RemoteAudioTrack;

  public onAutoplayFailed?: () => void;

  constructor(el: HTMLAudioElement, track: RemoteAudioTrack) {
    this.el = el;
    this.track = track;
  }

  mount() {
    if (!this.el || !this.track) return;

    this.el.srcObject = this.track.stream;
    this.el.autoplay = true;
    this.el.controls = false;

    this.el.play().catch((e) => {
      console.warn("[AudioBinder] Autoplay blocked:", e);
      if (this.onAutoplayFailed) this.onAutoplayFailed();
    });
  }

  unmount() {
    if (this.el) {
      this.el.srcObject = null;
    }
  }

  update(newTrack: RemoteAudioTrack) {
    if (this.track === newTrack) return;

    this.track = newTrack;

    // Re-assign stream
    if (this.el) {
      this.el.srcObject = this.track.stream;
      this.el.play().catch(() => { });
    }
  }
}
