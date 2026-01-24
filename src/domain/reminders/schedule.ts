import { generateContentWithContext } from "../../integrations/ai/gemini-client";
import { PROMPT_EXTRACT_REMINDER_DATA } from "../../integrations/ai/gemini-constants";
import { Reminder } from "./reminder.model";
import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { formatFriendlyDateTime, getBrazilTime, getBrazilWeekday } from "../../shared/utils/date.utils";
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
    const remindersData = await extractReminderData(message, userData.phoneNumber);

    // Criar todos os lembretes
    for (const reminderData of remindersData) {
        await Reminder.create({
            messageId: messageId,
            userPhoneNumber: userData.phoneNumber,
            title: reminderData.title.charAt(0).toUpperCase() + reminderData.title.slice(1),
            scheduledTime: new Date(reminderData.date),
            recurrence_type: reminderData.recurrence_type,
            recurrence_interval: reminderData.recurrence_interval,
            status: "pending",
        });
    }

    // Formatar mensagem de sucesso
    const successMessage = remindersData.length === 1
        ? formatReminderCreatedMessage(remindersData[0]!)
        : formatMultipleRemindersCreatedMessage(remindersData);

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

async function extractReminderData(message: string, userId: string): Promise<ReminderData[]> {
    let reminderData = await generateContentWithContext(
        userId,
        PROMPT_EXTRACT_REMINDER_DATA(message, getBrazilTime(), getBrazilWeekday()),
        'extract'
    );

    reminderData = reminderData.replace(/```json/g, "").replace(/```/g, "");

    return JSON.parse(reminderData) as ReminderData[];
}

function formatReminderCreatedMessage(reminderData: ReminderData): string {
    const recurrenceTypePtBr: Record<string, string> = {
        daily: reminderData.recurrence_interval === 1 ? "dia" : "dias",
        weekly: reminderData.recurrence_interval === 1 ? "semana" : "semanas",
        monthly: reminderData.recurrence_interval === 1 ? "mês" : "meses",
        yearly: reminderData.recurrence_interval === 1 ? "ano" : "anos",
    };

    const reminderDate = new Date(reminderData.date);
    const formattedDateTime = formatFriendlyDateTime(reminderDate);

    const recurrenceString = reminderData.recurrence_type !== "none"
        ? `, com recorrência a cada ${reminderData.recurrence_interval} ${recurrenceTypePtBr[reminderData.recurrence_type]}`
        : "";

    return `Lembrete criado para ${formattedDateTime}${recurrenceString}`;
}

function formatMultipleRemindersCreatedMessage(remindersData: ReminderData[]): string {
    const recurrenceTypePtBr: Record<string, string> = {
        daily: "dia",
        weekly: "semana",
        monthly: "mês",
        yearly: "ano",
    };

    const remindersText = remindersData.map((reminder, index) => {
        const reminderDate = new Date(reminder.date);
        const formattedDateTime = formatFriendlyDateTime(reminderDate);

        const recurrenceString = reminder.recurrence_type !== "none"
            ? `, com recorrência a cada ${reminder.recurrence_interval} ${reminder.recurrence_interval === 1 ? recurrenceTypePtBr[reminder.recurrence_type] : recurrenceTypePtBr[reminder.recurrence_type] + "s"}`
            : "";

        return `${index + 1}. *${reminder.title}* - ${formattedDateTime}${recurrenceString}`;
    }).join("\n");

    return `✅ ${remindersData.length} lembretes criados:\n\n${remindersText}`;
}

