import { classifyDelay, type DelayUnit } from "../../integrations/decision-ai/classify-delay";
import {
    findLastFromMeMessage,
    findMessageById,
} from "../../integrations/whatsapp/find-messages";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { UserData } from "../../integrations/whatsapp/types";
import { formatFriendlyDateTime, truncateToMinute } from "../../shared/utils/date.utils";
import { stripReminderPrefix } from "../../shared/utils/reminder-prefix.utils";
import { phoneVariantFilter } from "../contacts/phone";
import { Reminder } from "./reminder.model";

const DELAY_NOT_UNDERSTOOD =
    'Erro ao identificar o tempo de adiamento. Exemplo: "Adiar 30 minutos".';

const UNIT_MS: Record<Exclude<DelayUnit, "days">, number> = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
};

export function applyDelay(now: Date, amount: number, unit: DelayUnit): Date {
    if (unit === "days") {
        const next = new Date(now);
        next.setDate(next.getDate() + amount);
        return truncateToMinute(next);
    }

    return truncateToMinute(new Date(now.getTime() + amount * UNIT_MS[unit]));
}

export async function delayReminder({
    userData,
    quotedMsgId,
    messageText,
}: {
    userData: UserData;
    quotedMsgId?: string;
    messageText: string;
}): Promise<boolean> {
    const whatsappMessage = quotedMsgId
        ? await findMessageById(userData.phoneNumber, quotedMsgId)
        : await findLastFromMeMessage(userData.phoneNumber);

    if (!whatsappMessage) {
        await sendMessage({
            phone: userData.phoneNumber,
            message:
                "Não foi possível identificar o lembrete. Responda à mensagem do lembrete ou tente novamente.",
        });
        return false;
    }

    const title = stripReminderPrefix(whatsappMessage.text);
    const reminder = await Reminder.findOne({
        userPhoneNumber: phoneVariantFilter(userData.phoneNumber),
        title,
    }).sort({ updatedAt: -1 });

    if (!reminder) {
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Lembrete não encontrado",
        });
        return false;
    }

    const delay = await classifyDelay(messageText);
    if (!delay) {
        await sendMessage({
            phone: userData.phoneNumber,
            message: DELAY_NOT_UNDERSTOOD,
        });
        return false;
    }

    const scheduledDate = applyDelay(new Date(), delay.amount, delay.unit);
    reminder.scheduledTime = scheduledDate;
    reminder.status = "pending";
    await reminder.save();

    await sendMessage({
        phone: userData.phoneNumber,
        message: `Lembrete adiado com sucesso para ${formatFriendlyDateTime(scheduledDate)}`,
    });
    return true;
}
