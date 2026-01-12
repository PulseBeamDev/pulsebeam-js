// Reexport your entry components here

import "./theme.css";
import type { PlatformAdapter } from "@pulsebeam/core";
export * from "@pulsebeam/core";
export * as Card from "./components/ui/card";
export * as Table from "./components/ui/table";
export * as Tabs from "./components/ui/tabs";
export * as Avatar from "./components/ui/avatar";
export { Button } from "./components/ui/button";
export { Input } from "./components/ui/input";
export { Label } from "./components/ui/label";
export { Switch } from "./components/ui/switch";
export { Slider } from "./components/ui/slider";
export { Badge } from "./components/ui/badge";


export const WebAdapter: PlatformAdapter = {
  RTCPeerConnection: globalThis.RTCPeerConnection,
  MediaStream: globalThis.MediaStream,
  // We bind fetch to window to prevent "Illegal Invocation" errors in some browsers
  fetch: globalThis.fetch.bind(globalThis),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis)
};
