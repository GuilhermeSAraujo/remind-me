import type { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { Contact } from "./contact.model";
import { CONTATOS_EMPTY_MESSAGE, contatosListMessage } from "./messages";
import { digitsOnly } from "./phone";
import { findAcceptedContactsForUser } from "./queries";

export async function listContacts({
    userData,
}: {
    userData: UserData;
}): Promise<void> {
    const accepted = await findAcceptedContactsForUser(userData.phoneNumber);
    const pending = await Contact.find({
        inviterPhoneNumber: digitsOnly(userData.phoneNumber),
        status: "pending",
    });

    if (accepted.length === 0 && pending.length === 0) {
        await sendMessage({
            phone: userData.phoneNumber,
            message: CONTATOS_EMPTY_MESSAGE,
        });
        return;
    }

    const acceptedLines = accepted
        .map((c) => `• *${c.nickname}* — ${c.otherPhoneDigits}`)
        .join("\n");
    const pendingLines = pending
        .map((c) => `• *${c.inviterNicknameForInvitee}* — aguardando resposta`)
        .join("\n");

    await sendMessage({
        phone: userData.phoneNumber,
        message: contatosListMessage(acceptedLines, pendingLines),
    });
}
