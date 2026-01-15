import type { PlatformAdapter } from "@pulsebeam/core";
export * from "@pulsebeam/core";

export const WebAdapter: PlatformAdapter = {
  RTCPeerConnection: globalThis.RTCPeerConnection,
  MediaStream: globalThis.MediaStream,
  // We bind fetch to window to prevent "Illegal Invocation" errors in some browsers
  fetch: globalThis.fetch.bind(globalThis),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis)
};

