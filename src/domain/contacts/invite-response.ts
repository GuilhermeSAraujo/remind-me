import type { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { findUserByAnyPhone } from "../users/find-user-by-phone";
import type { IContact } from "./contact.model";
import {
    inviteAcceptedInviteeMessage,
    inviteAcceptedInviterMessage,
    inviteRejectedInviteeMessage,
    inviteRejectedInviterMessage,
    inviteUnknownReactionMessage,
} from "./messages";

const YES_TEXT = new Set([
    "sim",
    "s",
    "aceito",
    "aceitar",
    "pode",
    "quero",
    "claro",
    "yes",
]);

const NO_TEXT = new Set(["nao", "n", "recuso", "recusar", "no"]);

const YES_REACTIONS = new Set(["✅", "👍", "❤️", "❤"]);
const NO_REACTIONS = new Set(["❌", "👎"]);

function stripAccents(value: string): string {
    return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function classifyInviteText(message: string): "yes" | "no" | null {
    const normalized = stripAccents(message.trim().toLowerCase());
    if (YES_TEXT.has(normalized)) {
        return "yes";
    }
    if (NO_TEXT.has(normalized)) {
        return "no";
    }
    return null;
}

export function classifyInviteReaction(emoji: string): "yes" | "no" | "unknown" {
    if (YES_REACTIONS.has(emoji)) {
        return "yes";
    }
    if (NO_REACTIONS.has(emoji)) {
        return "no";
    }
    return "unknown";
}

export async function applyInviteDecision(params: {
    userData: UserData;
    contact: IContact;
    decision: "yes" | "no" | "unknown";
}): Promise<void> {
    const { userData, contact, decision } = params;

    if (decision === "unknown") {
        await sendMessage({
            phone: userData.phoneNumber,
            message: inviteUnknownReactionMessage(),
        });
        return;
    }

    const inviter = await findUserByAnyPhone(contact.inviterPhoneNumber);
    const inviterPhone = inviter?.phoneNumber ?? contact.inviterPhoneNumber;
    const inviterName = inviter?.name?.trim() || contact.inviterPhoneNumber;

    if (decision === "no") {
        contact.status = "rejected";
        await contact.save();

        await sendMessage({
            phone: userData.phoneNumber,
            message: inviteRejectedInviteeMessage(inviterName),
        });
        await sendMessage({
            phone: inviterPhone,
            message: inviteRejectedInviterMessage(contact.inviterNicknameForInvitee),
        });
        return;
    }

    // decision === "yes"
    const nicknameForInviter = inviter?.name?.trim() || "Contato";
    contact.status = "accepted";
    contact.inviteeNicknameForInviter = nicknameForInviter;
    await contact.save();

    await sendMessage({
        phone: userData.phoneNumber,
        message: inviteAcceptedInviteeMessage(nicknameForInviter),
    });
    await sendMessage({
        phone: inviterPhone,
        message: inviteAcceptedInviterMessage(contact.inviterNicknameForInvitee),
    });
}
