import { getAllMessagesFromChat } from "../../integrations/whatsapp/get-all-messages-from-chat";
import { getMessageById } from "../../integrations/whatsapp/get-message-by-id";
import { Reminder } from "./reminder.model";
import { stripReminderPrefix } from "../../shared/utils/reminder-prefix.utils";

export async function findReminderByMessageIdOrTextOrLastMessage(
    userPhoneNumber: string,
    quotedMsgId?: string
): Promise<typeof Reminder.prototype | null> {
    if (quotedMsgId) {
        // Try to find by messageId (respondendo a mensagem que criou o lembrete)
        let reminder = await Reminder.findOne({
            userPhoneNumber,
            messageId: quotedMsgId
        });

        if (!!reminder) {
            return reminder;
        }

        // texto da mensagem === lembrete em si || criação do lembrete pelo bot
        const message = await getMessageById(quotedMsgId);

        // Fallback: verificar se está respondendo a mensagem que ENVIOU o lembrete
        if (message) {
            reminder = await Reminder.findOne({
                userPhoneNumber,
                title: stripReminderPrefix(message.trim())
            });

            if (!!reminder) {
                return reminder;
            }
        }


        if (message?.startsWith("Lembrete criado para")) {
            const chatMessages = await getAllMessagesFromChat(userPhoneNumber)

            const messageIndex = chatMessages?.findIndex(msg => msg.id === quotedMsgId);
            if (messageIndex && messageIndex > 0) {
                const previousMessage = chatMessages?.[messageIndex - 1];
                const reminder = await Reminder.findOne({
                    userPhoneNumber,
                    messageId: previousMessage?.id || ""
                });
                if (!!reminder) {
                    return reminder;
                }
            }
        }

        console.log("[FIND REMINDER] 🚨 Reminder not found with quotedMsgId", {
            userPhoneNumber,
            quotedMsgId,
            message
        });

        return null;
    } else {
        const chatMessages = await getAllMessagesFromChat(userPhoneNumber)

        const messagesFromBot = chatMessages?.filter((m) => m.fromMe)

        const lastBotMessage = messagesFromBot?.[messagesFromBot?.length - 1]

        // just created the reminder
        if (lastBotMessage?.body?.startsWith("Lembrete criado para")) {
            const reminder = await Reminder.findOne({ userPhoneNumber }).sort({ createdAt: -1 })

            return reminder;
        }

        const reminder = await Reminder.findOne({ userPhoneNumber, title: stripReminderPrefix(lastBotMessage?.body?.trim() || "") })

        if (!!reminder) {
            return reminder;
        }

        console.log("[FIND REMINDER] 🚨 Reminder not found by context", {
            userPhoneNumber,
            lastBotMessage
        });

        return null;
    }
}

