import { choice, type ChoiceCriteria } from "@typesafe-ai/sdk";
import type { ReminderTarget } from "../../domain/contacts/resolve-reminder-target";
import type { AcceptedContact } from "../../domain/contacts/queries";
import { decisionClient } from "./client";

export const TARGET_CONFIDENCE_FLOOR = 0.5;

const FUNCTION_WORDS = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "um",
    "uma",
    "uns",
    "umas",
    "para",
    "pra",
    "pro",
    "por",
    "que",
    "se",
    "me",
    "te",
    "lhe",
    "com",
    "sem",
    "eu",
    "tu",
    "ele",
    "ela",
    "voce",
    "você",
    "ao",
    "aos",
    "às",
    "ou",
    "as",
    "os",
    "meu",
    "minha",
    "seu",
    "sua",
    "seus",
    "suas",
    "dele",
    "dela",
    "num",
    "numa",
    "pelo",
    "pela",
    "pelos",
    "pelas",
    "este",
    "esta",
    "isso",
    "isto",
    "esse",
    "essa",
    "aquele",
    "aquela",
]);

type ChoiceAnswer = { choice: string; confidence: number };

function contactId(index: number): string {
    return `c${index}`;
}

export function addresseeTokenCandidates(message: string): string[] {
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const raw of message.split(/\s+/)) {
        const token = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
        if (!/^\p{L}+$/u.test(token) || token.length < 2) {
            continue;
        }
        const key = token.toLocaleLowerCase("pt-BR");
        if (key === "none" || FUNCTION_WORDS.has(key) || seen.has(key)) {
            continue;
        }
        seen.add(key);
        tokens.push(token);
    }
    return tokens;
}

function recipientCriteria(contacts: AcceptedContact[]): ChoiceCriteria {
    const criteria: ChoiceCriteria = {
        self: {
            definition:
                "The sender wants the reminder for themselves. A saved contact mentioned only as part of the task still counts as self.",
            examples: [
                "Me lembre de ligar para a Isabela amanhã 10h",
                "Lembrete para ir ao médico amanhã às 10h",
                "Crie um lembrete para comprar pão",
            ],
            excludes: [
                "The sender is asking to remind, notify, or schedule a reminder for another person",
            ],
        },
    };

    for (const [index, contact] of contacts.entries()) {
        criteria[contactId(index)] = {
            definition: `The saved contact nicknamed "${contact.nickname}" should receive the reminder. Match that nickname, a diminutive, or varied phrasing such as avisa, manda lembrete, or lembra.`,
            examples: [
                `Lembre a ${contact.nickname} amanhã 12h de passear com o cachorro`,
                `Avisa a ${contact.nickname} amanhã`,
            ],
            excludes: [
                "The sender wants the reminder for themselves and only mentions this person inside the task",
            ],
        };
    }

    criteria.other = {
        definition:
            "The sender names a person who should receive the reminder, and that person is not one of the saved contacts.",
        examples: ["Lembre a Maria amanhã 10h de x"],
        excludes: ["The recipient is the sender", "The recipient is one of the saved contacts"],
    };

    return criteria;
}

function addresseeCriteria(tokens: string[]): ChoiceCriteria {
    const criteria: ChoiceCriteria = {};
    for (const token of tokens) {
        criteria[token] = {
            definition:
                "This word is the person the sender wants to remind, and that person is not a saved contact.",
        };
    }
    criteria.none = {
        definition: "No word in the message is a person being addressed.",
    };
    return criteria;
}

export function reminderTargetFromAnswers(
    contacts: AcceptedContact[],
    answers: { recipient: ChoiceAnswer; addressee: ChoiceAnswer },
): ReminderTarget {
    const { recipient, addressee } = answers;
    if (recipient.confidence < TARGET_CONFIDENCE_FLOOR || recipient.choice === "self") {
        return { kind: "self" };
    }

    if (recipient.choice === "other") {
        if (addressee.choice !== "none" && addressee.confidence >= TARGET_CONFIDENCE_FLOOR) {
            return { kind: "unknown_name", name: addressee.choice };
        }
        return { kind: "unknown_name" };
    }

    const index = /^c(\d+)$/.exec(recipient.choice);
    const contact = index ? contacts[Number(index[1])] : undefined;
    if (!contact) {
        return { kind: "self" };
    }

    return {
        kind: "contact",
        nickname: contact.nickname,
        ownerPhoneDigits: contact.otherPhoneDigits,
    };
}

export async function classifyReminderTarget(
    message: string,
    contacts: AcceptedContact[],
): Promise<ReminderTarget> {
    const tokens = addresseeTokenCandidates(message);
    const response = await decisionClient.systemOne({
        state: {
            message,
            contacts: contacts.map((contact, index) => ({
                id: contactId(index),
                nickname: contact.nickname,
            })),
        },
        questions: {
            recipient: choice(
                {
                    question: "Who should receive this reminder?",
                    use: "`message` and `contacts`",
                },
                recipientCriteria(contacts),
            ),
            addressee: choice(
                {
                    question:
                        "Which word is the person being addressed, when the reminder is for someone who is not a saved contact?",
                    use: "`message`",
                },
                addresseeCriteria(tokens),
            ),
        },
    });

    return reminderTargetFromAnswers(contacts, {
        recipient: response.answers.recipient,
        addressee: response.answers.addressee,
    });
}
