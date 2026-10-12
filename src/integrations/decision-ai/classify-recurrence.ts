import { choice, noul, type ChoiceCriteria } from "@typesafe-ai/sdk";
import {
    recurrenceFromAnswers,
    RECURRENCE_TYPES,
    type RecurrenceAnswers,
    type RecurrenceDecision,
} from "../../domain/reminders/recurrence-from-answers";
import { numberCandidates } from "../../shared/utils/number-candidates";
import { decisionClient } from "./client";

export type BaseReminder = {
    title: string;
    date: string;
};

const TYPE_CRITERIA: ChoiceCriteria = {
    none: {
        definition: "The reminder happens once. A single time such as tomorrow or at 14:00 is not repetition.",
    },
    hourly: {
        definition: "The reminder repeats every few hours, including phrases like de 4 em 4 horas or a cada 15 minutos.",
    },
    daily: {
        definition: "The reminder repeats every day or every few days, such as todo dia or diariamente.",
    },
    weekly: {
        definition: "The reminder repeats on a weekday every week, such as toda terça.",
    },
    monthly: {
        definition: "The reminder repeats every month on a calendar date, not on a named weekday of the month.",
    },
    yearly: {
        definition: "The reminder repeats every year.",
    },
    weekday: {
        definition: "The reminder repeats on business days, Monday through Friday.",
        examples: ["nos dias de semana", "dias úteis"],
    },
    weekend: {
        definition: "The reminder repeats on Saturday and Sunday.",
    },
    monthly_nth_weekday: {
        definition: "The reminder repeats on a numbered weekday of each month, such as the first Tuesday or the last Friday.",
    },
    monthly_last_business_day: {
        definition: "The reminder repeats on the last business day of each month.",
    },
    monthly_first_business_day: {
        definition: "The reminder repeats on the first business day of each month.",
    },
};

const WEEKDAY_CRITERIA: ChoiceCriteria = {
    "0": "domingo",
    "1": "segunda-feira",
    "2": "terça-feira",
    "3": "quarta-feira",
    "4": "quinta-feira",
    "5": "sexta-feira",
    "6": "sábado",
    none: "The reminder does not name a weekday, or the weekday is not needed.",
};

const NTH_CRITERIA: ChoiceCriteria = {
    "1": "primeira",
    "2": "segunda",
    "3": "terceira",
    "4": "quarta",
    "5": "quinta",
    last: "última",
    none: "The reminder does not say which occurrence of the weekday in the month.",
};

function amountCriteria(candidates: { value: number; text: string }[], absent: string, absentLabel: string): ChoiceCriteria {
    const criteria: ChoiceCriteria = {};
    for (const candidate of candidates) {
        criteria[String(candidate.value)] = `The number ${candidate.value}, from "${candidate.text}".`;
    }
    criteria[absentLabel] = absent;
    return criteria;
}

function answerOf(answers: Record<string, { choice?: string; confidence?: number; noul?: number }>, id: string) {
    return answers[id];
}

export async function classifyRecurrence(
    message: string,
    reminders: BaseReminder[],
): Promise<RecurrenceDecision[]> {
    if (reminders.length === 0) {
        return [];
    }

    const candidates = numberCandidates(message);
    const questions: Record<string, ReturnType<typeof choice> | ReturnType<typeof noul>> = {};

    for (const [index, reminder] of reminders.entries()) {
        const prefix = `r${index}_`;
        const about = `the reminder titled "${reminder.title}" scheduled at ${reminder.date}`;
        questions[`${prefix}type`] = choice(
            {
                question: `What repetition does the message state for ${about}? Use none unless repetition is explicit.`,
                use: "`message`",
            },
            TYPE_CRITERIA,
        );
        questions[`${prefix}weekday`] = choice(
            { question: `Which weekday does the message name for ${about}?`, use: "`message`" },
            WEEKDAY_CRITERIA,
        );
        questions[`${prefix}nth`] = choice(
            { question: `Which occurrence in the month does the message name for ${about}?`, use: "`message`" },
            NTH_CRITERIA,
        );
        questions[`${prefix}interval`] = choice(
            { question: `Which listed number is the repetition interval for ${about}?`, use: "`message` and `amounts`" },
            amountCriteria(candidates, "The message does not state an interval number.", "not_stated"),
        );
        questions[`${prefix}max_occurrences`] = choice(
            { question: `Which listed number is how many times ${about} should repeat?`, use: "`message` and `amounts`" },
            amountCriteria(candidates, "The message does not limit the number of repetitions.", "none"),
        );
        questions[`${prefix}end`] = choice(
            { question: `How does the message limit when ${about} stops?`, use: "`message`" },
            {
                none: "It does not give a duration or an end date.",
                for_days: "It lasts for a number of days, such as durante 5 dias.",
                for_weeks: "It lasts for a number of weeks, such as por 2 semanas.",
                until_date: "It stops on a named date, such as até sexta.",
            },
        );
        questions[`${prefix}end_amount`] = choice(
            { question: `Which listed number is the duration of ${about}?`, use: "`message` and `amounts`" },
            amountCriteria(candidates, "The message does not give a duration count.", "none"),
        );
        questions[`${prefix}every_day`] = noul(
            {
                question: `Does the message say ${about} repeats every day, with words like todo dia or diariamente?`,
                use: "`message`",
            },
            {
                true: "The repetition continues every day, without an end.",
                false: "The message does not say the repetition happens every day.",
            },
        );
        questions[`${prefix}sub_hour`] = noul(
            {
                question: `Is the repetition interval of ${about} shorter than one hour?`,
                use: "`message`",
            },
            {
                true: "The interval is in minutes, such as a cada 15 minutos.",
                false: "The interval is at least one hour, or there is no hourly interval.",
            },
        );
    }

    const response = await decisionClient.systemOne({
        state: {
            message,
            reminders,
            amounts: candidates.map((candidate) => ({
                id: String(candidate.value),
                value: candidate.value,
                text: candidate.text,
            })),
        },
        questions,
    });

    return reminders.map((reminder, index) => {
        const prefix = `r${index}_`;
        const raw = response.answers as unknown as Record<string, { choice: string; confidence: number; noul: number }>;
        const picked: RecurrenceAnswers = {
            type: answerOf(raw, `${prefix}type`) as RecurrenceAnswers["type"],
            weekday: answerOf(raw, `${prefix}weekday`) as RecurrenceAnswers["weekday"],
            nth: answerOf(raw, `${prefix}nth`) as RecurrenceAnswers["nth"],
            interval: answerOf(raw, `${prefix}interval`) as RecurrenceAnswers["interval"],
            max_occurrences: answerOf(raw, `${prefix}max_occurrences`) as RecurrenceAnswers["max_occurrences"],
            end: answerOf(raw, `${prefix}end`) as RecurrenceAnswers["end"],
            end_amount: answerOf(raw, `${prefix}end_amount`) as RecurrenceAnswers["end_amount"],
            every_day: answerOf(raw, `${prefix}every_day`) as RecurrenceAnswers["every_day"],
            sub_hour: answerOf(raw, `${prefix}sub_hour`) as RecurrenceAnswers["sub_hour"],
        };
        return recurrenceFromAnswers(reminder.date, picked, candidates);
    });
}

export { RECURRENCE_TYPES };
