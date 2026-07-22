import { describe, expect, it } from "vitest";
import { computeVideoSlotAssignments, type DesiredVideoTrack, type VideoSlotState } from "../src/participant";

function slots(mids: string[], assignedTo: Record<string, string | null> = {}): VideoSlotState[] {
  return mids.map(mid => ({ mid, currentTrackId: assignedTo[mid] ?? null }));
}

describe("computeVideoSlotAssignments", () => {
  it("assigns desired tracks to free slots when there is enough capacity", () => {
    const desired: DesiredVideoTrack[] = [
      { id: "a", height: 720 },
      { id: "b", height: 360 },
    ];
    const result = computeVideoSlotAssignments(desired, slots(["m1", "m2", "m3"]));

    expect(result.size).toBe(2);
    expect([...result.values()].map(v => v.trackId).sort()).toEqual(["a", "b"]);
  });

  it("keeps a slot's current assignment (no churn) when that track still deserves a slot", () => {
    const desired: DesiredVideoTrack[] = [
      { id: "a", height: 720 },
      { id: "b", height: 360 },
    ];
    const result = computeVideoSlotAssignments(
      desired,
      slots(["m1", "m2"], { m1: "b", m2: "a" }),
    );

    expect(result.get("m1")).toEqual({ trackId: "b", height: 360 });
    expect(result.get("m2")).toEqual({ trackId: "a", height: 720 });
  });

  it("evicts a lower-priority sticky track to make room for a higher-priority new one when slots are full", () => {
    // Regression guard: this is exactly the "screen share never becomes active"
    // starvation bug. Two camera tiles hold all slots; a screen share (taller,
    // therefore higher priority) becomes desired afterwards. It must win a slot
    // by evicting the lowest-priority current occupant, not be dropped.
    const camA: VideoSlotState = { mid: "m1", currentTrackId: "camA" };
    const camB: VideoSlotState = { mid: "m2", currentTrackId: "camB" };

    const desired: DesiredVideoTrack[] = [
      { id: "screenshare", height: 1080 },
      { id: "camA", height: 180 },
      { id: "camB", height: 180 },
    ];

    const result = computeVideoSlotAssignments(desired, [camA, camB]);

    expect(result.size).toBe(2);
    const trackIds = [...result.values()].map(v => v.trackId);
    expect(trackIds).toContain("screenshare");
    // Only one of the two lower-priority cams can survive with just 2 slots.
    expect(trackIds.filter(id => id === "camA" || id === "camB")).toHaveLength(1);
  });

  it("never assigns more tracks than there are slots, and drops the lowest-priority overflow", () => {
    const desired: DesiredVideoTrack[] = [
      { id: "a", height: 1080 },
      { id: "b", height: 720 },
      { id: "c", height: 360 },
    ];
    const result = computeVideoSlotAssignments(desired, slots(["m1", "m2"]));

    expect(result.size).toBe(2);
    const trackIds = [...result.values()].map(v => v.trackId);
    expect(trackIds).toEqual(expect.arrayContaining(["a", "b"]));
    expect(trackIds).not.toContain("c");
  });

  it("frees a slot when its track is no longer desired", () => {
    const desired: DesiredVideoTrack[] = [{ id: "b", height: 720 }];
    const result = computeVideoSlotAssignments(
      desired,
      slots(["m1"], { m1: "a" }),
    );

    expect(result.get("m1")).toEqual({ trackId: "b", height: 720 });
  });

  it("assigns nothing when there are no slots", () => {
    const desired: DesiredVideoTrack[] = [{ id: "a", height: 720 }];
    const result = computeVideoSlotAssignments(desired, []);
    expect(result.size).toBe(0);
  });

  it("leaves slots unassigned when there are fewer desired tracks than capacity", () => {
    const desired: DesiredVideoTrack[] = [{ id: "a", height: 720 }];
    const result = computeVideoSlotAssignments(desired, slots(["m1", "m2", "m3"]));
    expect(result.size).toBe(1);
  });
});
