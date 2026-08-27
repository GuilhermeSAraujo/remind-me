import type { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage, sendMessageGetId } from "../../integrations/whatsapp/send-message";
import { Contact, type IContact } from "./contact.model";
import {
    CADASTRO_FORMAT_MESSAGE,
    CADASTRO_SELF_MESSAGE,
    cadastroAlreadyAcceptedMessage,
    cadastroAlreadyPendingMessage,
    cadastroDuplicateNicknameMessage,
    cadastroInviteSentMessage,
    cadastroReversePendingMessage,
    cadastroSendFailedMessage,
    inviteToInviteeMessage,
} from "./messages";
import { contactDigits, normalizeBrazilPhone, phonesMatch } from "./phone";
import { findRelationship, nicknameTaken } from "./queries";

export function parseRegisterContact(
    message: string,
): { rawPhone: string; name: string } | null {
    const match = message.match(/^\s*cadastrar\s+pessoa\s+(.+)$/i);
    if (!match) {
        return null;
    }
    const remainder = match[1]!;
    const phoneMatch = remainder.match(/(\+?\d[\d\s().-]{7,}\d)/);
    if (!phoneMatch || phoneMatch.index === undefined) {
        return null;
    }
    let start = phoneMatch.index;
    let end = start + phoneMatch[1]!.length;
    // Include a leading '(' the digit-anchored phone regex cannot capture.
    if (start > 0 && remainder[start - 1] === "(") {
        start -= 1;
    }
    const rawPhone = remainder.slice(start, end);
    const name = remainder.slice(end).trim();
    if (!name) {
        return null;
    }
    return { rawPhone, name };
}

async function replyToInviter(phone: string, message: string): Promise<void> {
    await sendMessage({ phone, message });
}

export async function registerContact(params: {
    userData: UserData;
    message: string;
}): Promise<void> {
    const { userData, message } = params;
    const inviterPhone = userData.phoneNumber;

    const parsed = parseRegisterContact(message);
    if (!parsed) {
        await replyToInviter(inviterPhone, CADASTRO_FORMAT_MESSAGE);
        return;
    }

    const inviteeDigits = normalizeBrazilPhone(parsed.rawPhone);
    if (!inviteeDigits) {
        await replyToInviter(inviterPhone, CADASTRO_FORMAT_MESSAGE);
        return;
    }

    if (phonesMatch(userData.phoneNumber, inviteeDigits)) {
        await replyToInviter(inviterPhone, CADASTRO_SELF_MESSAGE);
        return;
    }

    const inviterDigits = normalizeBrazilPhone(userData.phoneNumber) ?? userData.phoneNumber;
    const existing = await findRelationship(inviterDigits, inviteeDigits);

    if (existing) {
        if (existing.status === "accepted") {
            const viewerIsInviter = phonesMatch(existing.inviterPhoneNumber, inviterDigits);
            const storedNickname = viewerIsInviter
                ? existing.inviterNicknameForInvitee
                : existing.inviteeNicknameForInviter;
            await replyToInviter(
                inviterPhone,
                cadastroAlreadyAcceptedMessage(storedNickname ?? parsed.name),
            );
            return;
        }

        if (existing.status === "pending") {
            const viewerIsInvitee = phonesMatch(existing.inviteePhoneNumber, inviterDigits);
            if (viewerIsInvitee) {
                await replyToInviter(inviterPhone, cadastroReversePendingMessage());
                return;
            }
            await replyToInviter(
                inviterPhone,
                cadastroAlreadyPendingMessage(existing.inviterNicknameForInvitee),
            );
            return;
        }
    }

    if (await nicknameTaken(inviterDigits, parsed.name, inviteeDigits)) {
        await replyToInviter(inviterPhone, cadastroDuplicateNicknameMessage(parsed.name));
        return;
    }

    const sent = await sendMessageGetId({
        phone: inviteeDigits,
        message: inviteToInviteeMessage(userData.name),
    });

    if (!sent) {
        await replyToInviter(inviterPhone, cadastroSendFailedMessage());
        return;
    }

    const storedInviteeDigits = inviteeDigitsFromSend(inviteeDigits, sent.remoteJid);
    const rejected = existing?.status === "rejected" ? existing : null;
    if (rejected) {
        await reopenRejectedContact(rejected, {
            inviterDigits,
            inviteeDigits: storedInviteeDigits,
            name: parsed.name,
            inviteMessageId: sent.id,
        });
    } else {
        await Contact.create({
            inviterPhoneNumber: inviterDigits,
            inviteePhoneNumber: storedInviteeDigits,
            inviterNicknameForInvitee: parsed.name,
            inviteeNicknameForInviter: null,
            status: "pending",
            inviteMessageId: sent.id,
        });
    }

    await replyToInviter(inviterPhone, cadastroInviteSentMessage(parsed.name));
}

function inviteeDigitsFromSend(cadastrarDigits: string, remoteJid: string | null): string {
    if (!remoteJid || remoteJid.includes("@lid")) {
        return cadastrarDigits;
    }
    const resolved = contactDigits(remoteJid);
    return resolved || cadastrarDigits;
}

async function reopenRejectedContact(
    contact: IContact,
    params: {
        inviterDigits: string;
        inviteeDigits: string;
        name: string;
        inviteMessageId: string;
    },
): Promise<void> {
    contact.inviterPhoneNumber = params.inviterDigits;
    contact.inviteePhoneNumber = params.inviteeDigits;
    contact.inviterNicknameForInvitee = params.name;
    contact.inviteeNicknameForInviter = null;
    contact.status = "pending";
    contact.inviteMessageId = params.inviteMessageId;
    await contact.save();
}
