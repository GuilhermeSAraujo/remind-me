import { generateContentWithContext } from "../../integrations/ai/gemini-client";
import { PROMPT_EXTRACT_REMINDER_DATA } from "../../integrations/ai/gemini-constants";
import { Reminder } from "./reminder.model";
import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { getBrazilTime } from "../../shared/utils/date.utils";
import { sendMessage } from "../../integrations/whatsapp/send-message";

export async function scheduleReminder({
    userData,
    message,
    messageId,
}: {
    userData: UserData;
    message: string;
    messageId: string;
}) {
    const reminderData = await extractReminderData(message, userData.phoneNumber);

    await Reminder.create({
        messageId: messageId,
        userPhoneNumber: userData.phoneNumber,
        title: reminderData.title.charAt(0).toUpperCase() + reminderData.title.slice(1),
        scheduledTime: new Date(reminderData.date),
        recurrence_type: reminderData.recurrence_type,
        recurrence_interval: reminderData.recurrence_interval,
        status: "pending",
    });

    const successMessage = formatReminderCreatedMessage(reminderData);

    await sendMessage({
        phone: userData.phoneNumber,
        message: successMessage,
    });
}

interface ReminderData {
    title: string;
    date: string;
    recurrence_type: "daily" | "weekly" | "monthly" | "yearly" | "none";
    recurrence_interval: number;
}

async function extractReminderData(message: string, userId: string): Promise<ReminderData> {
    let reminderData = await generateContentWithContext(
        userId,
        PROMPT_EXTRACT_REMINDER_DATA(message, getBrazilTime()),
        'extract'
    );

    reminderData = reminderData.replace(/```json/g, "").replace(/```/g, "");

    return JSON.parse(reminderData) as ReminderData;
}

function formatReminderCreatedMessage(reminderData: ReminderData): string {
    const recurrenceTypePtBr: Record<string, string> = {
        daily: reminderData.recurrence_interval === 1 ? "dia" : "dias",
        weekly: reminderData.recurrence_interval === 1 ? "semana" : "semanas",
        monthly: reminderData.recurrence_interval === 1 ? "mês" : "meses",
        yearly: reminderData.recurrence_interval === 1 ? "ano" : "anos",
    };

    const reminderDate = new Date(reminderData.date);
    const today = new Date(getBrazilTime());
    const tomorrow = new Date(getBrazilTime());
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Remove hours/minutes for date comparison
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    const reminderDateOnly = new Date(reminderDate);
    reminderDateOnly.setHours(0, 0, 0, 0);

    let dateDescription: string;
    if (reminderDateOnly.getTime() === today.getTime()) {
        dateDescription = "hoje";
    } else if (reminderDateOnly.getTime() === tomorrow.getTime()) {
        dateDescription = "amanhã";
    } else {
        dateDescription = `dia ${reminderDate.toLocaleDateString("pt-BR", {
            day: '2-digit',
            month: '2-digit',
        })}`;
    }

    const timeString = reminderDate.toLocaleString("pt-BR", {
        hour: '2-digit',
        minute: '2-digit',
    });

    const recurrenceString = reminderData.recurrence_type !== "none"
        ? `, com recorrência a cada ${reminderData.recurrence_interval} ${recurrenceTypePtBr[reminderData.recurrence_type]}`
        : "";

    return `Lembrete criado para ${dateDescription} às ${timeString}${recurrenceString}`;
}

