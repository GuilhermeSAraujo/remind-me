import {
    type AcceptedContact,
    findAcceptedContactsForUser,
} from "./queries";

export type ReminderTarget =
    | { kind: "self" }
    | { kind: "contact"; nickname: string; ownerPhoneDigits: string }
    | { kind: "unknown_name"; name: string };

const SELF_PATTERN = /\bme\s+lembr(e|ar|a)\b|\bpra\s+mim\b|\bpara\s+mim\b/i;

const TARGETING_PREFIX =
    /(lembr(?:e|ar|a)|agend(?:e|a)|cri(?:e|a)|lembrete)\s+(?:a|o|à|ao|pra|para\s+(?:a|o))\s+/i;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveReminderTargetFromContacts(
    message: string,
    contacts: AcceptedContact[],
): ReminderTarget {
    if (SELF_PATTERN.test(message)) {
        return { kind: "self" };
    }

    const match = TARGETING_PREFIX.exec(message);
    if (!match) {
        return { kind: "self" };
    }

    const nameRemainder = message.slice(match.index + match[0].length);
    const sorted = [...contacts].sort((a, b) => b.nickname.length - a.nickname.length);

    for (const contact of sorted) {
        const nick = contact.nickname;
        const prefixRe = new RegExp(`^${escapeRegExp(nick)}(?![\\p{L}\\p{N}])`, "iu");
        if (prefixRe.test(nameRemainder)) {
            return {
                kind: "contact",
                nickname: contact.nickname,
                ownerPhoneDigits: contact.otherPhoneDigits,
            };
        }
    }

    const unknownName = nameRemainder.trim().split(/\s+/)[0];
    if (unknownName && contacts.length > 0) {
        return { kind: "unknown_name", name: unknownName };
    }

    return { kind: "self" };
}

export async function resolveReminderTarget(
    senderPhone: string,
    message: string,
): Promise<ReminderTarget> {
    const contacts = await findAcceptedContactsForUser(senderPhone);
    return resolveReminderTargetFromContacts(message, contacts);
}

export function stripContactTarget(message: string, nickname: string): string {
    const re = new RegExp(
        `((?:lembr(?:e|ar|a)|agend(?:e|a)|cri(?:e|a)|lembrete))\\s+(?:a|o|à|ao|pra|para\\s+a|para\\s+o)\\s+${escapeRegExp(nickname)}(?![\\p{L}\\p{N}])`,
        "iu",
    );
    return message.replace(re, "$1");
}
