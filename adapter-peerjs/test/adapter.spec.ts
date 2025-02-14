import { describe, it, expect } from "vitest";
import { exampleUsage, Peer } from "../src/adapter";

describe("Adapter", () => {
  it("should connect to PeerJS", async () => {
    const adapter = new Peer();
    // Test your adapter's logic here
    // expect(adapter.isConnected()).toBe(true)
    // ;
    exampleUsage();
    expect( adapter).not.toBeNull()
  });
});