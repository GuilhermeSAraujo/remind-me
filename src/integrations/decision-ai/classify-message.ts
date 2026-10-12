import { choice } from "@typesafe-ai/sdk";
import type { AcceptedContact } from "../../domain/contacts/queries";
import type { ReminderTarget } from "../../domain/contacts/resolve-reminder-target";
import type { MessageIntent } from "../../domain/reminders/intent";
import { buildIntentQuestion, intentFromChoice } from "./classify-intent";
import { decisionClient } from "./client";
import { buildTargetQuestions, reminderTargetFromAnswers } from "./classify-reminder-target";

export const INVITE_CONFIDENCE_FLOOR = 0.7;

export type InviteResponse = "accept" | "reject";

export type MessageClassification = {
    intent: MessageIntent;
    target: ReminderTarget;
    inviteResponse: InviteResponse | null;
};

type ChoiceAnswer = { choice: string; confidence: number };

export function inviteResponseFromAnswer(
    answer: ChoiceAnswer | undefined,
): InviteResponse | null {
    if (!answer || answer.confidence < INVITE_CONFIDENCE_FLOOR) {
        return null;
    }
    if (answer.choice === "accept" || answer.choice === "reject") {
        return answer.choice;
    }
    return null;
}

export async function classifyMessage(input: {
    message: string;
    contacts: AcceptedContact[];
    pendingInvite: boolean;
}): Promise<MessageClassification> {
    const { message, contacts, pendingInvite } = input;
    const targetQuestions = buildTargetQuestions(message, contacts);
    const response = await decisionClient.systemOne({
        state: {
            message,
            contacts: contacts.map((contact, index) => ({
                id: `c${index}`,
                nickname: contact.nickname,
            })),
            ...(pendingInvite ? { pending_invite: true } : {}),
        },
        questions: {
            intent: buildIntentQuestion(),
            recipient: targetQuestions.recipient,
            addressee: targetQuestions.addressee,
            ...(pendingInvite
                ? {
                      invite_response: choice(
                          {
                              question:
                                  "Is the sender accepting or rejecting the pending contact invite?",
                              use: "`message` and `pending_invite`",
                          },
                          {
                              accept: {
                                  definition:
                                      "The sender agrees to the pending invite, even if the wording is not the single word sim.",
                                  examples: ["pode sim, aceito", "claro que sim", "quero sim"],
                              },
                              reject: {
                                  definition:
                                      "The sender declines the pending invite, even if the wording is not the single word não.",
                                  examples: ["melhor não", "não quero", "agora não"],
                              },
                              unrelated: {
                                  definition:
                                      "The message is not an answer to the invite. A reminder or other request that merely starts with sim is unrelated.",
                                  examples: ["sim, me lembre de comprar pão"],
                              },
                          },
                      ),
                  }
                : {}),
        },
    });

    console.info("Decision AI JEV response:", response);

    const answers = response.answers as unknown as {
        intent: { choice: MessageIntent; confidence: number };
        recipient: ChoiceAnswer;
        addressee: ChoiceAnswer;
        invite_response?: ChoiceAnswer;
    };

    return {
        intent: intentFromChoice(answers.intent),
        target: reminderTargetFromAnswers(contacts, {
            recipient: answers.recipient,
            addressee: answers.addressee,
        }),
        inviteResponse: pendingInvite ? inviteResponseFromAnswer(answers.invite_response) : null,
    };
}
