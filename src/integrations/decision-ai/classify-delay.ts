import { choice, type ChoiceCriteria } from "@typesafe-ai/sdk";
import { numberCandidates, type NumberCandidate } from "../../shared/utils/number-candidates";
import { decisionClient } from "./client";

export const DELAY_CONFIDENCE_FLOOR = 0.6;

export type DelayUnit = "minutes" | "hours" | "days";

export type DelayAmount = {
    amount: number;
    unit: DelayUnit;
};

type ChoiceAnswer = { choice: string; confidence: number };

function amountId(value: number): string {
    return String(value);
}

export function delayFromAnswers(
    candidates: NumberCandidate[],
    answers: { unit: ChoiceAnswer; amount: ChoiceAnswer },
): DelayAmount | null {
    const { unit, amount } = answers;
    if (
        unit.confidence < DELAY_CONFIDENCE_FLOOR ||
        amount.confidence < DELAY_CONFIDENCE_FLOOR ||
        unit.choice === "unclear" ||
        amount.choice === "none"
    ) {
        return null;
    }

    if (unit.choice !== "minutes" && unit.choice !== "hours" && unit.choice !== "days") {
        return null;
    }

    const candidate = candidates.find((item) => amountId(item.value) === amount.choice);
    if (!candidate) {
        return null;
    }

    return { amount: candidate.value, unit: unit.choice };
}

function amountCriteria(candidates: NumberCandidate[]): ChoiceCriteria {
    const criteria: ChoiceCriteria = {};
    for (const candidate of candidates) {
        criteria[amountId(candidate.value)] = {
            definition: `The delay amount is ${candidate.value}, taken from "${candidate.text}".`,
        };
    }
    criteria.none = {
        definition: "The message does not state how long to delay.",
    };
    return criteria;
}

export async function classifyDelay(message: string): Promise<DelayAmount | null> {
    const candidates = numberCandidates(message);
    if (candidates.length === 0) {
        return null;
    }

    const response = await decisionClient.systemOne({
        state: {
            message,
            amounts: candidates.map((candidate) => ({
                id: amountId(candidate.value),
                value: candidate.value,
                text: candidate.text,
            })),
        },
        questions: {
            unit: choice(
                {
                    question: "Which unit of time does the delay in `message` use?",
                    use: "`message`",
                },
                {
                    minutes: {
                        definition: "The delay is in minutes.",
                        examples: ["Adiar 30 minutos", "meia hora"],
                    },
                    hours: {
                        definition: "The delay is in hours.",
                        examples: ["Adiar 2 horas", "atrasar duas horas"],
                    },
                    days: {
                        definition: "The delay is in calendar days.",
                        examples: ["Adiar 1 dia", "Adiar 2 dias"],
                    },
                    unclear: {
                        definition: "The message does not say whether the amount is minutes, hours, or days.",
                        examples: ["Adiar 30"],
                    },
                },
            ),
            amount: choice(
                {
                    question: "Which listed amount is the delay in `message`?",
                    use: "`message` and `amounts`",
                },
                amountCriteria(candidates),
            ),
        },
    });

    return delayFromAnswers(candidates, {
        unit: response.answers.unit,
        amount: response.answers.amount,
    });
}
