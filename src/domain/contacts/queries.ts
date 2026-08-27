import { Contact, IContact } from "./contact.model";
import { brazilianPhoneVariants, phonesMatch } from "./phone";

export async function findRelationship(
    phoneA: string,
    phoneB: string,
): Promise<IContact | null> {
    const a = brazilianPhoneVariants(phoneA);
    const b = brazilianPhoneVariants(phoneB);
    return Contact.findOne({
        $or: [
            { inviterPhoneNumber: { $in: a }, inviteePhoneNumber: { $in: b } },
            { inviterPhoneNumber: { $in: b }, inviteePhoneNumber: { $in: a } },
        ],
    });
}

export async function nicknameTaken(
    viewerPhone: string,
    nickname: string,
    exceptOtherPhone?: string,
): Promise<boolean> {
    const viewerVariants = brazilianPhoneVariants(viewerPhone);
    const needle = nickname.trim().toLowerCase();
    const contacts = await Contact.find({
        status: { $in: ["pending", "accepted"] },
        $or: [
            { inviterPhoneNumber: { $in: viewerVariants } },
            { inviteePhoneNumber: { $in: viewerVariants } },
        ],
    });

    for (const contact of contacts) {
        const viewerIsInviter = phonesMatch(contact.inviterPhoneNumber, viewerPhone);
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
    const variants = brazilianPhoneVariants(phone);
    const contacts = await Contact.find({
        status: "accepted",
        $or: [
            { inviterPhoneNumber: { $in: variants } },
            { inviteePhoneNumber: { $in: variants } },
        ],
    });

    const result: AcceptedContact[] = [];
    for (const contact of contacts) {
        const viewerIsInviter = phonesMatch(contact.inviterPhoneNumber, phone);
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
    if (phonesMatch(relationship.inviterPhoneNumber, viewerPhone)) {
        return relationship.inviterNicknameForInvitee;
    }
    return relationship.inviteeNicknameForInviter;
}

export async function findPendingByInviteMessageId(
    inviteePhone: string,
    inviteMessageId: string,
): Promise<IContact | null> {
    const byPhone = await Contact.findOne({
        inviteMessageId,
        status: "pending",
        inviteePhoneNumber: { $in: brazilianPhoneVariants(inviteePhone) },
    });
    if (byPhone) {
        return byPhone;
    }
    return Contact.findOne({
        inviteMessageId,
        status: "pending",
    });
}

export async function findLatestPendingForInvitee(
    inviteePhone: string,
): Promise<IContact | null> {
    return Contact.findOne({
        inviteePhoneNumber: { $in: brazilianPhoneVariants(inviteePhone) },
        status: "pending",
    }).sort({ updatedAt: -1 });
}
