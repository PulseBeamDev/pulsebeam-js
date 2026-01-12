// Reexport your entry components here

import type { PlatformAdapter } from "@pulsebeam/core";
export * from "@pulsebeam/core";
export * as Card from "./components/ui/card/index.ts";
export * as Table from "./components/ui/table/index.ts";
export * as Tabs from "./components/ui/tabs/index.ts";
export * as Avatar from "./components/ui/avatar/index.ts";
export { Button } from "./components/ui/button/index.ts";
export { Input } from "./components/ui/input/index.ts";
export { Label } from "./components/ui/label/index.ts";
export { Switch } from "./components/ui/switch/index.ts";
export { Slider } from "./components/ui/slider/index.ts";
export { Badge } from "./components/ui/badge/index.ts";


export const WebAdapter: PlatformAdapter = {
  RTCPeerConnection: globalThis.RTCPeerConnection,
  MediaStream: globalThis.MediaStream,
  // We bind fetch to window to prevent "Illegal Invocation" errors in some browsers
  fetch: globalThis.fetch.bind(globalThis),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis)
};
