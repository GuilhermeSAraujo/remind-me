import { generateContent } from "../ai";
import { PROMPT_EXTRACT_REMINDER_DATA } from "../ai/consts";
import { Reminder } from "../db/schemas";
import { UserData } from "../middlewares";
import { sendMessage } from "../whatsApp";

export async function scheduleReminder({
    userData,
    message,
}: {
    userData: UserData;
    message: string;
}) {
    const reminderData = await extractReminderData(message);

    // save on database
    // mongoose

    await Reminder.create({
        userPhoneNumber: userData.phoneNumber,
        title: reminderData.title.charAt(0).toUpperCase() + reminderData.title.slice(1),
        scheduledTime: new Date(reminderData.date),
        recurrence_type: reminderData.recurrence_type,
        recurrence_interval: reminderData.recurrence_interval,
        status: "pending",
    });

    const recurrenceTypePtBr: Record<string, string> = {
        daily: reminderData.recurrence_interval === 1 ? "dia" : "dias",
        weekly: reminderData.recurrence_interval === 1 ? "semana" : "semanas",
        monthly: reminderData.recurrence_interval === 1 ? "mês" : "meses",
        yearly: reminderData.recurrence_interval === 1 ? "ano" : "anos",
    };

    await sendMessage({
        phone: userData.phoneNumber,
        message: `Lembrete criado com sucesso para ${new Date(reminderData.date).toLocaleString("pt-BR", {
            hour: '2-digit',
            minute: '2-digit',
        })} ${reminderData.recurrence_type !== "none" ? `a cada ${reminderData.recurrence_interval} ${recurrenceTypePtBr[reminderData.recurrence_type]}` : ""}`,
    });
}

interface ReminderData {
    title: string;
    date: string;
    recurrence_type: "daily" | "weekly" | "monthly" | "yearly" | "none";
    recurrence_interval: number;
}

async function extractReminderData(message: string): Promise<ReminderData> {
    let reminderData = await generateContent(
        PROMPT_EXTRACT_REMINDER_DATA(message, new Date().toISOString())
    );

    reminderData = reminderData.replace(/```json/g, "").replace(/```/g, "");

    return JSON.parse(reminderData);
}

