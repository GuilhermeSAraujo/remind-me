import { describe, it, expect } from "vitest";
import { shouldStopRecurrence } from "./recurrence.utils";

describe("shouldStopRecurrence", () => {
    it("returns false when no limits are set", () => {
        expect(shouldStopRecurrence({
            sentCount: 3,
            maxOccurrences: null,
            endDate: null,
            nextScheduledTime: new Date("2026-04-01T10:00:00"),
        })).toBe(false);
    });

    it("returns true when sentCount reaches maxOccurrences", () => {
        expect(shouldStopRecurrence({
            sentCount: 5,
            maxOccurrences: 5,
            endDate: null,
            nextScheduledTime: new Date("2026-04-01T10:00:00"),
        })).toBe(true);
    });

    it("returns false when sentCount is below maxOccurrences", () => {
        expect(shouldStopRecurrence({
            sentCount: 4,
            maxOccurrences: 5,
            endDate: null,
            nextScheduledTime: new Date("2026-04-01T10:00:00"),
        })).toBe(false);
    });

    it("returns true when nextScheduledTime is after endDate", () => {
        expect(shouldStopRecurrence({
            sentCount: 1,
            maxOccurrences: null,
            endDate: new Date("2026-03-16T00:00:00"),
            nextScheduledTime: new Date("2026-03-17T10:00:00"),
        })).toBe(true);
    });

    it("returns false when nextScheduledTime is before endDate", () => {
        expect(shouldStopRecurrence({
            sentCount: 1,
            maxOccurrences: null,
            endDate: new Date("2026-03-20T00:00:00"),
            nextScheduledTime: new Date("2026-03-17T10:00:00"),
        })).toBe(false);
    });

    it("returns true when maxOccurrences is hit even if endDate is not yet passed", () => {
        expect(shouldStopRecurrence({
            sentCount: 5,
            maxOccurrences: 5,
            endDate: new Date("2026-04-01T00:00:00"),
            nextScheduledTime: new Date("2026-03-17T10:00:00"),
        })).toBe(true);
    });

    it("returns true when endDate is passed even if maxOccurrences is not yet hit", () => {
        expect(shouldStopRecurrence({
            sentCount: 2,
            maxOccurrences: 10,
            endDate: new Date("2026-03-16T00:00:00"),
            nextScheduledTime: new Date("2026-03-17T10:00:00"),
        })).toBe(true);
    });
});
