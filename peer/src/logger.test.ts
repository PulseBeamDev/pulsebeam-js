import { afterEach, describe, expect, it } from "vitest";
import { Logger, PRETTY_LOG_SINK } from "./logger.ts";

describe("logger", () => {
  it("should stop recursing", () => {
    const logger = new Logger("base", {}, PRETTY_LOG_SINK);
    const obj1: Record<string, any> = { "a": null };
    const obj2 = { b: obj1 };
    obj1.a = obj2;

    logger.info("test", obj1);
  });
});
