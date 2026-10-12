import { choice, type ChoiceCriteria } from "@typesafe-ai/sdk";
import { formatFriendlyDateTime } from "../../shared/utils/date.utils";
import { decisionClient } from "./client";

export const DELETE_CONFIDENCE_FLOOR = 0.8;

export type DeleteReminderCandidate = {
    title: string;
    scheduledTime: Date;
};

type ChoiceAnswer = { choice: string; confidence: number };

function reminderId(index: number): string {
    return `r${index}`;
}

export function deleteTargetFromAnswer(
    reminderCount: number,
    answer: ChoiceAnswer,
): number | null {
    if (answer.confidence < DELETE_CONFIDENCE_FLOOR || answer.choice === "none") {
        return null;
    }

    const match = /^r(\d+)$/.exec(answer.choice);
    if (!match) {
        return null;
    }

    const index = Number(match[1]);
    if (index < 0 || index >= reminderCount) {
        return null;
    }

    return index;
}

function targetCriteria(reminders: DeleteReminderCandidate[]): ChoiceCriteria {
    const criteria: ChoiceCriteria = {};

    for (const [index, reminder] of reminders.entries()) {
        const when = formatFriendlyDateTime(reminder.scheduledTime);
        criteria[reminderId(index)] = {
            definition: `The user wants to delete the reminder titled "${reminder.title}", scheduled ${when}.`,
            examples: [
                `Apagar lembrete de ${reminder.title}`,
                `Deletar ${reminder.title}`,
            ],
            excludes: ["A different reminder", "The user is not naming a reminder"],
        };
    }

    criteria.none = {
        definition:
            "The message does not clearly name one of the listed reminders, or it could match more than one.",
        examples: ["Apagar", "Deletar lembrete"],
        excludes: ["The user names one listed reminder"],
    };

    return criteria;
}

export async function classifyDeleteTarget(
    message: string,
    reminders: DeleteReminderCandidate[],
): Promise<number | null> {
    if (reminders.length === 0) {
        return null;
    }

    const response = await decisionClient.systemOne({
        state: {
            message,
            reminders: reminders.map((reminder, index) => ({
                id: reminderId(index),
                title: reminder.title,
                when: formatFriendlyDateTime(reminder.scheduledTime),
            })),
        },
        questions: {
            target: choice(
                {
                    question: "Which listed reminder does the user want to delete?",
                    use: "`message` and `reminders`",
                },
                targetCriteria(reminders),
            ),
        },
    });

    return deleteTargetFromAnswer(reminders.length, response.answers.target);
}
