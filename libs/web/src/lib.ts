import type { PlatformAdapter, ParticipantConfig, RemoteVideoTrack, RemoteAudioTrack } from "@pulsebeam/core";
export type * from "@pulsebeam/core";
export { RemoteAudioTrack, RemoteVideoTrack, ParticipantEvent } from "@pulsebeam/core";
import {
  createParticipant as createCoreParticipant,
  createDeviceManager as createCoreDeviceManager,
  createDisplayManager as createCoreDisplayManager,
} from "@pulsebeam/core";
import adapter from "webrtc-adapter";

export const BrowserAdapter: PlatformAdapter = {
  RTCPeerConnection: globalThis.RTCPeerConnection,
  MediaStream: globalThis.MediaStream,
  getCapabilities: (kind) => {
    if (globalThis.RTCRtpSender && globalThis.RTCRtpSender.getCapabilities) {
      return globalThis.RTCRtpSender.getCapabilities(kind);
    }
    return null;
  },
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
  mediaDevices: globalThis.navigator?.mediaDevices,
};

export function createParticipant(config: ParticipantConfig) {
  if (adapter.browserDetails.browser == "firefox" && !!adapter.browserDetails.version && adapter.browserDetails.version < 146) {
    // TODO: this firefox requires at least 1 audio recv-only.. 
    config.audioSlots = Math.max(config.audioSlots, 1);
  }

  return createCoreParticipant(BrowserAdapter, config);
}

export function createDeviceManager() {
  return createCoreDeviceManager(BrowserAdapter);
}

export function createDisplayManager() {
  return createCoreDisplayManager(BrowserAdapter);
}

export class VideoBinder {
  private el: HTMLVideoElement;
  private track: RemoteVideoTrack;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  private isIntersecting: boolean = true; // Optimistic init
  private isTabVisible: boolean = !document.hidden;
  private isPiP: boolean = false;
  private lastValidHeight: number = 0;

  public onAutoplayFailed?: () => void;

  constructor(el: HTMLVideoElement, track: RemoteVideoTrack) {
    this.el = el;
    this.track = track;
  }

  mount() {
    if (!this.el || !this.track) return;

    // attributes for autoplay/mobile
    this.el.playsInline = true;
    this.el.autoplay = true;
    this.el.muted = true;
    this.el.srcObject = this.track.stream;

    this.addListeners();
    this.attemptPlay();
    this.syncTrackState();
  }

  unmount() {
    this.removeListeners();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();

    if (this.el) {
      this.el.pause(); // Release hardware decoder immediately
      this.el.srcObject = null;
      this.el.removeAttribute("src");
    }
  }

  update(newTrack: RemoteVideoTrack) {
    if (this.track === newTrack) return;
    this.track = newTrack;

    if (this.el) {
      this.el.srcObject = this.track.stream;
      this.attemptPlay();
      this.syncTrackState();
    }
  }

  private addListeners() {
    document.addEventListener("visibilitychange", this.handleVisibility);
    window.addEventListener("focus", this.handleFocus);
    this.el.addEventListener("enterpictureinpicture", this.handleEnterPiP);
    this.el.addEventListener("leavepictureinpicture", this.handleLeavePiP);

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.el);

    this.intersectionObserver = new IntersectionObserver(this.handleIntersection, {
      threshold: 0,
      rootMargin: "200px" // Pre-load offscreen
    });
    this.intersectionObserver.observe(this.el);
  }

  private removeListeners() {
    document.removeEventListener("visibilitychange", this.handleVisibility);
    window.removeEventListener("focus", this.handleFocus);
    if (this.el) {
      this.el.removeEventListener("enterpictureinpicture", this.handleEnterPiP);
      this.el.removeEventListener("leavepictureinpicture", this.handleLeavePiP);
    }
  }

  private attemptPlay() {
    this.el.play().catch((e) => {
      if (e.name === "NotAllowedError" && this.onAutoplayFailed) {
        this.onAutoplayFailed();
      }
      // Ignore AbortError (happens on rapid track switching)
    });
  }

  private handleVisibility = () => {
    this.isTabVisible = !document.hidden;
    this.syncTrackState();
  };

  private handleFocus = () => {
    this.isTabVisible = true;
    this.syncTrackState();
  };

  private handleEnterPiP = () => {
    this.isPiP = true;
    this.syncTrackState();
  };

  private handleLeavePiP = () => {
    this.isPiP = false;
    this.syncTrackState();
  };

  private handleResize = (entries: ResizeObserverEntry[]) => {
    const { height } = entries[0].contentRect;
    if (height > 0) this.lastValidHeight = height;
    this.syncTrackState();
  };

  private handleIntersection = (entries: IntersectionObserverEntry[]) => {
    const entry = entries[0];
    this.isIntersecting = entry.isIntersecting || entry.intersectionRatio > 0;
    this.syncTrackState();
  };

  private syncTrackState() {
    // 1. PiP Priority: Always active
    if (this.isPiP) {
      this.track.setHeight(this.lastValidHeight || 360);
      return;
    }

    // 2. Standard Visibility
    if (!this.isTabVisible || !this.isIntersecting) {
      this.track.setHeight(0);
      return;
    }

    // 3. Size calculation with flicker protection
    const rect = this.el.getBoundingClientRect();
    let height = Math.round(rect.height);

    // Recover from transient layout 0x0
    if (height === 0 && this.lastValidHeight > 0) {
      height = this.lastValidHeight;
    } else if (height > 0) {
      this.lastValidHeight = height;
    }

    this.track.setHeight(height);
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
