import { Contact, IContact } from "./contact.model";
import { digitsOnly, normalizeBrazilPhone, phonesMatch } from "./phone";

/** Digits for Contact lookups: Brazil-normalize when possible, else strip non-digits. */
function contactDigits(phone: string): string {
    return normalizeBrazilPhone(phone) ?? digitsOnly(phone);
}

export async function findRelationship(
    phoneA: string,
    phoneB: string,
): Promise<IContact | null> {
    const a = contactDigits(phoneA);
    const b = contactDigits(phoneB);
    return Contact.findOne({
        $or: [
            { inviterPhoneNumber: a, inviteePhoneNumber: b },
            { inviterPhoneNumber: b, inviteePhoneNumber: a },
        ],
    });
}

export async function nicknameTaken(
    viewerPhone: string,
    nickname: string,
    exceptOtherPhone?: string,
): Promise<boolean> {
    const viewerDigits = contactDigits(viewerPhone);
    const needle = nickname.trim().toLowerCase();
    const contacts = await Contact.find({
        status: { $in: ["pending", "accepted"] },
        $or: [{ inviterPhoneNumber: viewerDigits }, { inviteePhoneNumber: viewerDigits }],
    });

    for (const contact of contacts) {
        const viewerIsInviter = phonesMatch(contact.inviterPhoneNumber, viewerDigits);
        const otherPhone = viewerIsInviter
            ? contact.inviteePhoneNumber
            : contact.inviterPhoneNumber;

        if (exceptOtherPhone && phonesMatch(otherPhone, exceptOtherPhone)) {
            continue;
        }

        const nicknameForOther = viewerIsInviter
            ? contact.inviterNicknameForInvitee
            : contact.inviteeNicknameForInviter;

        if (nicknameForOther && nicknameForOther.trim().toLowerCase() === needle) {
            return true;
        }
    }

    return false;
}

export type AcceptedContact = { nickname: string; otherPhoneDigits: string };

export async function findAcceptedContactsForUser(
    phone: string,
): Promise<AcceptedContact[]> {
    const digits = contactDigits(phone);
    const contacts = await Contact.find({
        status: "accepted",
        $or: [{ inviterPhoneNumber: digits }, { inviteePhoneNumber: digits }],
    });

    const result: AcceptedContact[] = [];
    for (const contact of contacts) {
        const viewerIsInviter = phonesMatch(contact.inviterPhoneNumber, digits);
        const nickname = viewerIsInviter
            ? contact.inviterNicknameForInvitee
            : contact.inviteeNicknameForInviter;
        if (!nickname) {
            continue;
        }
        result.push({
            nickname,
            otherPhoneDigits: viewerIsInviter
                ? contact.inviteePhoneNumber
                : contact.inviterPhoneNumber,
        });
    }
    return result;
}

export async function nicknameForOther(
    viewerPhone: string,
    otherPhone: string,
): Promise<string | null> {
    const relationship = await findRelationship(viewerPhone, otherPhone);
    if (!relationship) {
        return null;
    }
    const viewerDigits = contactDigits(viewerPhone);
    if (phonesMatch(relationship.inviterPhoneNumber, viewerDigits)) {
        return relationship.inviterNicknameForInvitee;
    }
    return relationship.inviteeNicknameForInviter;
}

export async function findPendingByInviteMessageId(
    inviteePhone: string,
    inviteMessageId: string,
): Promise<IContact | null> {
    return Contact.findOne({
        inviteMessageId,
        status: "pending",
        inviteePhoneNumber: contactDigits(inviteePhone),
    });
}

export async function findLatestPendingForInvitee(
    inviteePhone: string,
): Promise<IContact | null> {
    return Contact.findOne({
        inviteePhoneNumber: contactDigits(inviteePhone),
        status: "pending",
    }).sort({ updatedAt: -1 });
}
