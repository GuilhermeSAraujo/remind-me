import { describe, it, expect } from "vitest";
import {
    shouldStopRecurrence,
    calculateNextScheduledTime,
    getNthWeekdayOfMonth,
    getFirstBusinessDayOfMonth,
    getLastBusinessDayOfMonth,
    getBrazilianHolidays,
} from "./recurrence.utils";

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

const TIME_10H = new Date("2026-01-01T10:00:00");

describe("getNthWeekdayOfMonth", () => {
    it("returns the first Tuesday of March 2026 (March 3)", () => {
        const result = getNthWeekdayOfMonth(2026, 2, 2, 1, TIME_10H);
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(2);
        expect(result.getDate()).toBe(3);
        expect(result.getHours()).toBe(10);
    });

    it("returns the third Wednesday of March 2026 (March 18)", () => {
        const result = getNthWeekdayOfMonth(2026, 2, 3, 3, TIME_10H);
        expect(result.getDate()).toBe(18);
    });

    it("returns the last Friday of March 2026 (March 27) when nth=-1", () => {
        const result = getNthWeekdayOfMonth(2026, 2, 5, -1, TIME_10H);
        expect(result.getDate()).toBe(27);
    });

    it("returns the last Monday of March 2026 (March 30) when nth=-1", () => {
        const result = getNthWeekdayOfMonth(2026, 2, 1, -1, TIME_10H);
        expect(result.getDate()).toBe(30);
    });

    it("preserves hour and minute from the time parameter", () => {
        const time = new Date("2026-01-01T14:30:00");
        const result = getNthWeekdayOfMonth(2026, 2, 2, 1, time);
        expect(result.getHours()).toBe(14);
        expect(result.getMinutes()).toBe(30);
    });

    it("returns the first Tuesday of April 2026 (April 7)", () => {
        const result = getNthWeekdayOfMonth(2026, 3, 2, 1, TIME_10H);
        expect(result.getDate()).toBe(7);
    });
});

describe("getFirstBusinessDayOfMonth", () => {
    it("returns April 1 for April 2026 (no holidays needed — it is a Wednesday)", () => {
        const result = getFirstBusinessDayOfMonth(2026, 3, TIME_10H);
        expect(result.getDate()).toBe(1);
        expect(result.getMonth()).toBe(3);
    });

    it("skips Jan 1 (Ano Novo) when holidays are provided, returning Jan 2", () => {
        const holidays = getBrazilianHolidays(2026);
        const result = getFirstBusinessDayOfMonth(2026, 0, TIME_10H, holidays);
        expect(result.getDate()).toBe(2);
    });

    it("skips May 1 (Dia do Trabalho) when holidays are provided, returning May 4", () => {
        const holidays = getBrazilianHolidays(2026);
        const result = getFirstBusinessDayOfMonth(2026, 4, TIME_10H, holidays);
        expect(result.getDate()).toBe(4);
    });

    it("preserves hour and minute", () => {
        const time = new Date("2026-01-01T09:15:00");
        const result = getFirstBusinessDayOfMonth(2026, 3, time);
        expect(result.getHours()).toBe(9);
        expect(result.getMinutes()).toBe(15);
    });
});

describe("getLastBusinessDayOfMonth", () => {
    it("returns March 31 for March 2026 (Tuesday — no weekend skip needed)", () => {
        const result = getLastBusinessDayOfMonth(2026, 2, TIME_10H);
        expect(result.getDate()).toBe(31);
    });

    it("returns April 30 for April 2026 (Thursday)", () => {
        const result = getLastBusinessDayOfMonth(2026, 3, TIME_10H);
        expect(result.getDate()).toBe(30);
    });

    it("skips Sunday May 31, returning Friday May 29", () => {
        const result = getLastBusinessDayOfMonth(2026, 4, TIME_10H);
        expect(result.getDate()).toBe(29);
    });

    it("preserves hour and minute", () => {
        const time = new Date("2026-01-01T18:00:00");
        const result = getLastBusinessDayOfMonth(2026, 2, time);
        expect(result.getHours()).toBe(18);
        expect(result.getMinutes()).toBe(0);
    });
});

describe("getBrazilianHolidays", () => {
    it("includes Jan 1 (Ano Novo)", () => {
        const holidays = getBrazilianHolidays(2026);
        const janFirst = holidays.find(d => d.getMonth() === 0 && d.getDate() === 1);
        expect(janFirst).toBeDefined();
    });

    it("includes Apr 21 (Tiradentes)", () => {
        const holidays = getBrazilianHolidays(2026);
        const tiradentes = holidays.find(d => d.getMonth() === 3 && d.getDate() === 21);
        expect(tiradentes).toBeDefined();
    });

    it("includes Sexta-feira Santa (April 3 in 2026, Easter − 2 days)", () => {
        const holidays = getBrazilianHolidays(2026);
        const sextaSanta = holidays.find(d => d.getMonth() === 3 && d.getDate() === 3);
        expect(sextaSanta).toBeDefined();
    });

    it("includes Corpus Christi (June 4 in 2026, Easter + 60 days)", () => {
        const holidays = getBrazilianHolidays(2026);
        const corpusChristi = holidays.find(d => d.getMonth() === 5 && d.getDate() === 4);
        expect(corpusChristi).toBeDefined();
    });
});

describe("calculateNextScheduledTime – calendar rule types", () => {
    it("monthly_nth_weekday: advances to first Tuesday of next month", () => {
        const fired = new Date("2026-03-03T10:00:00");
        const next = calculateNextScheduledTime(fired, "monthly_nth_weekday", 1, {
            weekday: 2,
            nth: 1,
        });
        expect(next.getMonth()).toBe(3);
        expect(next.getDate()).toBe(7);
        expect(next.getHours()).toBe(10);
    });

    it("monthly_nth_weekday: advances to last Friday of next month (nth=-1)", () => {
        const fired = new Date("2026-03-27T10:00:00");
        const next = calculateNextScheduledTime(fired, "monthly_nth_weekday", 1, {
            weekday: 5,
            nth: -1,
        });
        expect(next.getMonth()).toBe(3);
        expect(next.getDate()).toBe(24);
    });

    it("monthly_last_business_day: advances to last business day of next month", () => {
        const fired = new Date("2026-03-31T10:00:00");
        const next = calculateNextScheduledTime(fired, "monthly_last_business_day", 1);
        expect(next.getMonth()).toBe(3);
        expect(next.getDate()).toBe(30);
        expect(next.getHours()).toBe(10);
    });

    it("monthly_first_business_day: skips holiday, advances to first non-holiday weekday", () => {
        const fired = new Date("2026-04-01T10:00:00");
        const next = calculateNextScheduledTime(fired, "monthly_first_business_day", 1);
        expect(next.getMonth()).toBe(4);
        expect(next.getDate()).toBe(4);
    });

    it("monthly_nth_weekday with interval=2: skips two months ahead", () => {
        const fired = new Date("2026-03-03T10:00:00");
        const next = calculateNextScheduledTime(fired, "monthly_nth_weekday", 2, {
            weekday: 2,
            nth: 1,
        });
        expect(next.getMonth()).toBe(4);
        expect(next.getDate()).toBe(5);
    });
});
