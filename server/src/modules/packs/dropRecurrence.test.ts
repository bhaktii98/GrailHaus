import { describe, expect, it } from "vitest";
import { computeDropOccurrence, type DropRecurrenceRule } from "./dropRecurrence.js";

const MON_WED_FRI: DropRecurrenceRule = { weekdays: [1, 3, 5], timeUtc: "18:00", durationMinutes: 120 };

describe("computeDropOccurrence", () => {
  it("returns 'soon' with the next occurrence when before any window", () => {
    // Sunday 2024-01-07 10:00 UTC — next Mon/Wed/Fri 18:00 is Monday 2024-01-08.
    const now = new Date("2024-01-07T10:00:00.000Z");
    const occ = computeDropOccurrence(MON_WED_FRI, now);
    expect(occ?.phase).toBe("soon");
    expect(occ?.goesLiveAt.toISOString()).toBe("2024-01-08T18:00:00.000Z");
    expect(occ?.endsAt.toISOString()).toBe("2024-01-08T20:00:00.000Z");
  });

  it("returns 'live' partway through today's window", () => {
    // Monday 2024-01-08, 19:00 UTC — inside the 18:00-20:00 window.
    const now = new Date("2024-01-08T19:00:00.000Z");
    const occ = computeDropOccurrence(MON_WED_FRI, now);
    expect(occ?.phase).toBe("live");
    expect(occ?.goesLiveAt.toISOString()).toBe("2024-01-08T18:00:00.000Z");
    expect(occ?.endsAt.toISOString()).toBe("2024-01-08T20:00:00.000Z");
  });

  it("rolls to the next occurrence right after one ends", () => {
    // Monday 2024-01-08, 20:00:01 UTC — just past that day's window; next is Wednesday.
    const now = new Date("2024-01-08T20:00:01.000Z");
    const occ = computeDropOccurrence(MON_WED_FRI, now);
    expect(occ?.phase).toBe("soon");
    expect(occ?.goesLiveAt.toISOString()).toBe("2024-01-10T18:00:00.000Z");
  });

  it("wraps across a week boundary (Friday's window has passed, next is Monday)", () => {
    // Saturday 2024-01-13, 00:00 UTC.
    const now = new Date("2024-01-13T00:00:00.000Z");
    const occ = computeDropOccurrence(MON_WED_FRI, now);
    expect(occ?.phase).toBe("soon");
    expect(occ?.goesLiveAt.toISOString()).toBe("2024-01-15T18:00:00.000Z");
  });

  it("returns null for an empty weekday list", () => {
    expect(computeDropOccurrence({ weekdays: [], timeUtc: "18:00", durationMinutes: 60 }, new Date())).toBeNull();
  });

  it("returns null for a non-positive duration", () => {
    expect(computeDropOccurrence({ weekdays: [1], timeUtc: "18:00", durationMinutes: 0 }, new Date())).toBeNull();
  });

  it("handles a single-weekday rule spanning midnight UTC", () => {
    const rule: DropRecurrenceRule = { weekdays: [0], timeUtc: "23:30", durationMinutes: 90 };
    // Sunday 2024-01-07 23:45 UTC — 15 minutes into a window that ends 01:00 Monday.
    const now = new Date("2024-01-07T23:45:00.000Z");
    const occ = computeDropOccurrence(rule, now);
    expect(occ?.phase).toBe("live");
    expect(occ?.endsAt.toISOString()).toBe("2024-01-08T01:00:00.000Z");
  });
});
