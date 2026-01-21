import { getAllMessagesFromChat } from "../../integrations/whatsapp/get-all-messages-from-chat";
import { getMessageById } from "../../integrations/whatsapp/get-message-by-id";
import { Reminder } from "./reminder.model";

export async function findReminderByMessageIdOrTextOrLastMessage(
    userPhoneNumber: string,
    quotedMsgId?: string
): Promise<typeof Reminder.prototype | null> {
    if (quotedMsgId) {
        console.log("[FIND REMINDER] Finding reminder by messageId:", quotedMsgId);
        // Try to find by messageId (respondendo a mensagem que criou o lembrete)
        let reminder = await Reminder.findOne({
            userPhoneNumber,
            messageId: quotedMsgId
        });

        console.log("[FIND REMINDER] Reminder found by messageId:", reminder);

        if (!!reminder) {
            return reminder;
        }

        // Fallback: verificar se está respondendo a mensagem que ENVIOU o lembrete
        // texto da mensagem === lembrete em si
        const message = await getMessageById(quotedMsgId);

        console.log("[FIND REMINDER] Message found:", message);

        if (message) {
            reminder = await Reminder.findOne({
                userPhoneNumber,
                title: message.trim()
            });
        }

        console.log("[FIND REMINDER] Reminder found by text:", reminder);

        return reminder;
    } else {
        const chatMessages = await getAllMessagesFromChat(userPhoneNumber)

        const messagesFromBot = chatMessages?.filter((m) => m.fromMe)

        const lastBotMessage = messagesFromBot?.[messagesFromBot?.length - 1]

        if (lastBotMessage?.body?.startsWith("Lembrete criado para")) {
            const reminder = await Reminder.findOne({ userPhoneNumber }).sort({ createdAt: -1 })

            return reminder;
        }

        return null;
    }
}

