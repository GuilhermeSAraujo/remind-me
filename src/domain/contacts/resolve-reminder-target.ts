import { classifyReminderTarget } from "../../integrations/decision-ai/classify-reminder-target";
import { findAcceptedContactsForUser } from "./queries";

export type ReminderTarget =
    | { kind: "self" }
    | { kind: "contact"; nickname: string; ownerPhoneDigits: string }
    | { kind: "unknown_name"; name?: string };

export async function resolveReminderTarget(
    senderPhone: string,
    message: string,
): Promise<ReminderTarget> {
    const contacts = await findAcceptedContactsForUser(senderPhone);
    return classifyReminderTarget(message, contacts);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripContactTarget(message: string, nickname: string): string {
    const article = "(?:para\\s+(?:a|o|à|ao)\\s+|(?:a|o|à|ao|pra|pro|para)\\s+)";
    const re = new RegExp(
        `(?<![\\p{L}\\p{N}])${article}?${escapeRegExp(nickname)}(?![\\p{L}\\p{N}])[,:]?`,
        "iu",
    );
    return message.replace(re, " ").replace(/\s{2,}/g, " ").trim();
}
