import { Session, type SessionConfig } from "@pulsebeam/core";
import { WebAdapter } from "./adapter";

export * from "./binder";
export * from "./adapter";
export * from "./device";

export class WebSession extends Session {
  constructor(config: Omit<SessionConfig, "adapter">) {
    super({
      ...config,
      adapter: WebAdapter,
    });
  }
}
