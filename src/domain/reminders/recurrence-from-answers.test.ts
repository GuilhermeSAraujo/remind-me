import { describe, expect, it } from "vitest";
import type { NumberCandidate } from "../../shared/utils/number-candidates";
import {
    recurrenceFromAnswers,
    type RecurrenceAnswers,
} from "./recurrence-from-answers";

function choice(value: string, confidence = 0.9) {
    return { choice: value, confidence };
}

function answers(overrides: Partial<RecurrenceAnswers> = {}): RecurrenceAnswers {
    return {
        type: choice("none"),
        weekday: choice("none"),
        nth: choice("none"),
        interval: choice("not_stated"),
        max_occurrences: choice("none"),
        end: choice("none"),
        end_amount: choice("none"),
        every_day: { noul: 0.05 },
        sub_hour: { noul: 0.05 },
        ...overrides,
    };
}

const noAmounts: NumberCandidate[] = [];

describe("recurrenceFromAnswers", () => {
    it("keeps a single reminder with no repetition", () => {
        const result = recurrenceFromAnswers("2026-01-17 14:00:00", answers(), noAmounts);
        expect(result).toEqual({
            fallback: false,
            data: {
                recurrence_type: "none",
                recurrence_interval: 0,
                recurrence_weekday: null,
                recurrence_nth: null,
                max_occurrences: null,
                end_date: null,
            },
        });
    });

    it("reads daily, weekly, and weekday recurrences", () => {
        expect(
            recurrenceFromAnswers("2026-01-26 07:00:00", answers({ type: choice("daily") }), noAmounts),
        ).toMatchObject({ fallback: false, data: { recurrence_type: "daily", recurrence_interval: 1, end_date: null } });

        expect(
            recurrenceFromAnswers("2026-01-21 14:00:00", answers({ type: choice("weekly") }), noAmounts),
        ).toMatchObject({ fallback: false, data: { recurrence_type: "weekly", recurrence_interval: 1, recurrence_weekday: null } });

        expect(
            recurrenceFromAnswers("2026-01-26 07:00:00", answers({ type: choice("weekday") }), noAmounts),
        ).toMatchObject({ fallback: false, data: { recurrence_type: "weekday", recurrence_interval: 1 } });
    });

    it("adds an explicit duration onto the first occurrence", () => {
        const result = recurrenceFromAnswers(
            "2026-03-11 08:00:00",
            answers({
                type: choice("hourly"),
                interval: choice("8"),
                end: choice("for_days"),
                end_amount: choice("5"),
            }),
            [
                { value: 8, text: "8" },
                { value: 5, text: "5" },
            ],
        );

        expect(result.fallback).toBe(false);
        if (result.fallback) return;
        expect(result.data.recurrence_type).toBe("hourly");
        expect(result.data.recurrence_interval).toBe(8);
        expect(result.data.end_date?.startsWith("2026-03-16")).toBe(true);
    });

    it("closes an hourly reminder at the end of the same day", () => {
        const result = recurrenceFromAnswers(
            "2026-03-15 08:00:00",
            answers({ type: choice("hourly"), interval: choice("4") }),
            [{ value: 4, text: "quatro" }],
        );

        expect(result).toMatchObject({
            fallback: false,
            data: {
                recurrence_type: "hourly",
                recurrence_interval: 4,
                end_date: "2026-03-15 23:59:59",
            },
        });
    });

    it("clamps a sub-hour interval to one hour and keeps the repetition count", () => {
        const result = recurrenceFromAnswers(
            "2026-03-11 08:00:00",
            answers({
                type: choice("hourly"),
                interval: choice("15"),
                sub_hour: { noul: 0.95 },
                max_occurrences: choice("5"),
            }),
            [
                { value: 15, text: "15" },
                { value: 5, text: "5" },
            ],
        );

        expect(result).toMatchObject({
            fallback: false,
            data: {
                recurrence_type: "hourly",
                recurrence_interval: 1,
                max_occurrences: 5,
                end_date: "2026-03-11 23:59:59",
            },
        });
    });

    it("reads monthly calendar rules", () => {
        expect(
            recurrenceFromAnswers(
                "2026-03-31 10:00:00",
                answers({ type: choice("monthly_last_business_day") }),
                noAmounts,
            ),
        ).toMatchObject({
            fallback: false,
            data: { recurrence_type: "monthly_last_business_day", recurrence_interval: 1, end_date: null },
        });

        expect(
            recurrenceFromAnswers(
                "2026-04-07 09:00:00",
                answers({
                    type: choice("monthly_nth_weekday"),
                    weekday: choice("2"),
                    nth: choice("1"),
                }),
                noAmounts,
            ),
        ).toMatchObject({
            fallback: false,
            data: {
                recurrence_type: "monthly_nth_weekday",
                recurrence_weekday: 2,
                recurrence_nth: 1,
            },
        });
    });

    it("falls back for a stated end date or a weak type", () => {
        expect(
            recurrenceFromAnswers(
                "2026-03-11 08:00:00",
                answers({ type: choice("daily"), end: choice("until_date") }),
                noAmounts,
            ),
        ).toEqual({ fallback: true });

        expect(
            recurrenceFromAnswers("2026-03-11 08:00:00", answers({ type: choice("daily", 0.4) }), noAmounts),
        ).toEqual({ fallback: true });
    });
});
