import adapter from "webrtc-adapter";
export * from "./peer";

adapter.disableLog(false);
adapter.disableWarnings(false);
console.log("UA: ", navigator.userAgent);
console.log("webrtc-adapter is enabled", JSON.stringify({ shim: adapter.browserShim, version: adapter.browserDetails }, null, 2));
