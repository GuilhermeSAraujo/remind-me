import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { classifyDeleteTarget } from "../../integrations/decision-ai/classify-delete-target";
import {
    findMessageById,
} from "../../integrations/whatsapp/find-messages";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { formatFriendlyDateTime } from "../../shared/utils/date.utils";
import { stripReminderPrefix } from "../../shared/utils/reminder-prefix.utils";
import { phoneVariantFilter } from "../contacts/phone";
import { Reminder, type IReminder } from "./reminder.model";
import { getRemindersInListOrder } from "./reminders-list-order.helper";

/**
 * Extrai um número de uma mensagem de deletar (ex: "apagar 1", "deletar 2", "remover 3")
 * Retorna o número encontrado ou null se não houver número válido
 */
function extractNumberFromMessage(message: string): number | null {
    const pattern = /(?:apagar|apague|deletar|delete|remove|remova|exclui|excluir|cancela|cancele)\s+(\d+)/i;
    const match = message.match(pattern);

    if (match && match[1]) {
        const number = parseInt(match[1], 10);
        return isNaN(number) ? null : number;
    }

    return null;
}

function unidentifiedMessage(reminders: IReminder[]): string {
    if (reminders.length === 0) {
        return "Você não tem lembretes pendentes.";
    }

    const lines = reminders
        .map(
            (reminder, index) =>
                `${index + 1}. ${reminder.title} — ${formatFriendlyDateTime(reminder.scheduledTime)}`,
        )
        .join("\n");

    return `Não foi possível identificar o lembrete a ser deletado. Envie "apagar N":\n\n${lines}`;
}

async function deleteOwned(userData: UserData, reminder: IReminder): Promise<boolean> {
    console.log("[DELETE REMINDER] ⚠ Reminder found?:", reminder);
    await Reminder.deleteOne({
        _id: reminder._id,
        userPhoneNumber: phoneVariantFilter(userData.phoneNumber),
    });

    await sendMessage({
        phone: userData.phoneNumber,
        message: `Lembrete "${reminder.title}" apagado com sucesso.`,
    });
    return true;
}

export async function deleteReminder({
    userData,
    quotedMsgId,
    messageText,
}: {
    userData: UserData;
    quotedMsgId?: string;
    messageText?: string;
}): Promise<boolean> {
    const reminders = await getRemindersInListOrder(userData.phoneNumber);

    if (messageText) {
        const listNumber = extractNumberFromMessage(messageText);

        if (listNumber !== null) {
            if (listNumber >= 1 && listNumber <= reminders.length) {
                return deleteOwned(userData, reminders[listNumber - 1]!);
            }

            await sendMessage({
                phone: userData.phoneNumber,
                message: `Número inválido. Você tem ${reminders.length} lembrete(s) pendente(s). Use um número entre 1 e ${reminders.length}.`,
            });
            return false;
        }
    }

    if (quotedMsgId) {
        const whatsappMessage = await findMessageById(userData.phoneNumber, quotedMsgId);
        if (whatsappMessage) {
            const title = stripReminderPrefix(whatsappMessage.text);
            const quoted = await Reminder.findOne({
                userPhoneNumber: phoneVariantFilter(userData.phoneNumber),
                title,
            }).sort({ updatedAt: -1 });

            if (quoted) {
                return deleteOwned(userData, quoted);
            }
        }
    }

    if (messageText && reminders.length > 0) {
        const index = await classifyDeleteTarget(
            messageText,
            reminders.map((reminder) => ({
                title: reminder.title,
                scheduledTime: reminder.scheduledTime,
            })),
        );
        if (index != null) {
            return deleteOwned(userData, reminders[index]!);
        }
    }

    await sendMessage({
        phone: userData.phoneNumber,
        message: unidentifiedMessage(reminders),
    });
    return false;
}
