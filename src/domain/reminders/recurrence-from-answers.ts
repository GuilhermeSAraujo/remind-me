import type { NumberCandidate } from "../../shared/utils/number-candidates";
import { parseBrazilDateString, toBrazilDateTimeString } from "../../shared/utils/date.utils";

export const RECURRENCE_CONFIDENCE_FLOOR = 0.6;

export const RECURRENCE_TYPES = [
    "hourly",
    "daily",
    "weekly",
    "monthly",
    "yearly",
    "weekday",
    "weekend",
    "monthly_nth_weekday",
    "monthly_last_business_day",
    "monthly_first_business_day",
    "none",
] as const;

export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export type RecurrenceData = {
    recurrence_type: RecurrenceType;
    recurrence_interval: number;
    recurrence_weekday: number | null;
    recurrence_nth: number | null;
    max_occurrences: number | null;
    end_date: string | null;
};

export const RECURRENCE_FALLBACK: RecurrenceData = {
    recurrence_type: "none",
    recurrence_interval: 0,
    recurrence_weekday: null,
    recurrence_nth: null,
    max_occurrences: null,
    end_date: null,
};

type ChoiceAnswer = { choice: string; confidence: number };

export type RecurrenceAnswers = {
    type: ChoiceAnswer;
    weekday: ChoiceAnswer;
    nth: ChoiceAnswer;
    interval: ChoiceAnswer;
    max_occurrences: ChoiceAnswer;
    end: ChoiceAnswer;
    end_amount: ChoiceAnswer;
    every_day: { noul: number };
    sub_hour: { noul: number };
};

export type RecurrenceDecision =
    | { fallback: true }
    | { fallback: false; data: RecurrenceData };

function sure(answer: ChoiceAnswer): boolean {
    return answer.confidence >= RECURRENCE_CONFIDENCE_FLOOR;
}

function noulBand(probability: number): "yes" | "no" | "unsure" {
    if (probability >= RECURRENCE_CONFIDENCE_FLOOR) {
        return "yes";
    }
    if (probability <= 1 - RECURRENCE_CONFIDENCE_FLOOR) {
        return "no";
    }
    return "unsure";
}

function addDays(dateTime: string, days: number): string {
    const next = parseBrazilDateString(dateTime);
    next.setDate(next.getDate() + days);
    return toBrazilDateTimeString(next);
}

function amount(choice: string, candidates: NumberCandidate[]): number | null {
    const candidate = candidates.find((item) => String(item.value) === choice);
    return candidate ? candidate.value : null;
}

export function recurrenceFromAnswers(
    baseDate: string,
    answers: RecurrenceAnswers,
    candidates: NumberCandidate[],
): RecurrenceDecision {
    if (!sure(answers.type) || !RECURRENCE_TYPES.includes(answers.type.choice as RecurrenceType)) {
        return { fallback: true };
    }

    const recurrenceType = answers.type.choice as RecurrenceType;
    if (recurrenceType === "none") {
        return { fallback: false, data: { ...RECURRENCE_FALLBACK } };
    }

    if (!sure(answers.interval) || !sure(answers.max_occurrences) || !sure(answers.end)) {
        return { fallback: true };
    }

    let interval = answers.interval.choice === "not_stated" ? 1 : amount(answers.interval.choice, candidates);
    if (interval == null) {
        return { fallback: true };
    }

    if (recurrenceType === "hourly") {
        const subHour = noulBand(answers.sub_hour.noul);
        if (subHour === "unsure") {
            return { fallback: true };
        }
        if (subHour === "yes" || interval < 1) {
            interval = 1;
        }
        interval = Math.max(1, Math.round(interval));
    }

    let recurrenceWeekday: number | null = null;
    let recurrenceNth: number | null = null;
    if (recurrenceType === "monthly_nth_weekday") {
        if (!sure(answers.weekday) || answers.weekday.choice === "none") {
            return { fallback: true };
        }
        if (!sure(answers.nth) || answers.nth.choice === "none") {
            return { fallback: true };
        }
        recurrenceWeekday = Number(answers.weekday.choice);
        recurrenceNth = answers.nth.choice === "last" ? -1 : Number(answers.nth.choice);
        if (!Number.isInteger(recurrenceWeekday) || !Number.isInteger(recurrenceNth)) {
            return { fallback: true };
        }
    }

    const maxOccurrences =
        answers.max_occurrences.choice === "none"
            ? null
            : amount(answers.max_occurrences.choice, candidates);
    if (answers.max_occurrences.choice !== "none" && maxOccurrences == null) {
        return { fallback: true };
    }

    if (answers.end.choice === "until_date") {
        return { fallback: true };
    }

    let endDate: string | null = null;
    if (answers.end.choice === "for_days" || answers.end.choice === "for_weeks") {
        if (!sure(answers.end_amount) || answers.end_amount.choice === "none") {
            return { fallback: true };
        }
        const count = amount(answers.end_amount.choice, candidates);
        if (count == null) {
            return { fallback: true };
        }
        const days = answers.end.choice === "for_weeks" ? count * 7 : count;
        endDate = addDays(baseDate, days);
    } else if (answers.end.choice !== "none") {
        return { fallback: true };
    }

    if (recurrenceType === "hourly" && answers.end.choice === "none") {
        const everyDay = noulBand(answers.every_day.noul);
        if (everyDay === "unsure") {
            return { fallback: true };
        }
        if (everyDay === "no") {
            const [datePart] = baseDate.split(" ");
            endDate = `${datePart} 23:59:59`;
        }
    }

    return {
        fallback: false,
        data: {
            recurrence_type: recurrenceType,
            recurrence_interval: interval,
            recurrence_weekday: recurrenceWeekday,
            recurrence_nth: recurrenceNth,
            max_occurrences: maxOccurrences,
            end_date: endDate,
        },
    };
}
