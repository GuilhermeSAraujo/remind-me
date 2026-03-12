import { generateContentWithContext, getIdentificationType } from "../../integrations/ai/gemini-client";
import {
    PROMPT_EXTRACT_REMINDER_DATA,
    PROMPT_EXTRACT_REMINDER_BASE,
    PROMPT_EXTRACT_RECURRENCE,
} from "../../integrations/ai/gemini-constants";
import { Reminder } from "./reminder.model";
import { UserData } from "../../api/middlewares/user-extractor.middleware";
import {
    formatFriendlyDateTime,
    getBrazilWeekday,
    parseBrazilDateString,
    toBrazilDateTimeString,
} from "../../shared/utils/date.utils";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { startTyping } from "../../integrations/whatsapp/start-typing";
import { calculateNextScheduledTime } from "./recurrence.utils";

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
        let scheduledTime = parseBrazilDateString(reminderData.date);
        const now = new Date();

        // Se a data agendada está no passado E existe recorrência, reagendar para próxima ocorrência
        if (scheduledTime < now && reminderData.recurrence_type !== "none") {
            scheduledTime = calculateNextScheduledTime(
                scheduledTime,
                reminderData.recurrence_type,
                reminderData.recurrence_interval,
            );
        }

        await Reminder.create({
            messageId: messageId,
            userPhoneNumber: userData.phoneNumber,
            title: reminderData.title.charAt(0).toUpperCase() + reminderData.title.slice(1),
            scheduledTime: scheduledTime,
            recurrence_type: reminderData.recurrence_type,
            recurrence_interval: reminderData.recurrence_interval,
            status: "pending",
            maxOccurrences: reminderData.max_occurrences ?? null,
            endDate: reminderData.end_date ? parseBrazilDateString(reminderData.end_date) : null,
            sentCount: 0,
        });
    }

    // Formatar mensagem de sucesso
    const successMessage =
        remindersData.length === 1
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
    recurrence_type:
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "weekday"
    | "weekend"
    | "none";
    recurrence_interval: number;
    max_occurrences?: number | null;
    end_date?: string | null;
}

interface BaseReminderData {
    title: string;
    date: string;
}

interface RecurrenceData {
    recurrence_type: ReminderData["recurrence_type"];
    recurrence_interval: number;
    max_occurrences: number | null;
    end_date: string | null;
}

const RECURRENCE_FALLBACK: RecurrenceData = {
    recurrence_type: "none",
    recurrence_interval: 0,
    max_occurrences: null,
    end_date: null,
};

async function extractReminderData(message: string, userId: string): Promise<ReminderData[]> {
    if (getIdentificationType() === "multi-prompt") {
        return extractReminderDataMultiPrompt(message, userId);
    }

    await startTyping({ phone: userId });
    let reminderData = await generateContentWithContext(
        userId,
        PROMPT_EXTRACT_REMINDER_DATA(message, toBrazilDateTimeString(new Date()), getBrazilWeekday()),
        "extract",
    );
    reminderData = reminderData.replace(/```json/g, "").replace(/```/g, "");
    return JSON.parse(reminderData) as ReminderData[];
}

async function extractReminderDataMultiPrompt(
    message: string,
    userId: string,
): Promise<ReminderData[]> {
    await startTyping({ phone: userId });

    // Step 1: extract base fields (title + date only)
    let baseRaw = await generateContentWithContext(
        userId,
        PROMPT_EXTRACT_REMINDER_BASE(message, toBrazilDateTimeString(new Date()), getBrazilWeekday()),
        "extract",
    );
    baseRaw = baseRaw.replace(/```json/g, "").replace(/```/g, "");
    const baseReminders = JSON.parse(baseRaw) as BaseReminderData[];

    // Step 2: extract recurrence for each reminder (reuses same chat session context)
    await startTyping({ phone: userId });
    const reminders: ReminderData[] = [];
    for (const base of baseReminders) {
        let recurrenceData: RecurrenceData = RECURRENCE_FALLBACK;
        try {
            let recurrenceRaw = await generateContentWithContext(
                userId,
                PROMPT_EXTRACT_RECURRENCE(message, base.title, base.date),
                "extract",
            );
            recurrenceRaw = recurrenceRaw.replace(/```json/g, "").replace(/```/g, "");
            recurrenceData = JSON.parse(recurrenceRaw) as RecurrenceData;
        } catch (err) {
            const isParseError = err instanceof SyntaxError;
            console.warn(
                `[AI] Recurrence ${isParseError ? "parse" : "call"} failed for "${base.title}", falling back to none:`,
                err,
            );
        }

        reminders.push({
            title: base.title,
            date: base.date,
            recurrence_type: recurrenceData.recurrence_type,
            recurrence_interval: recurrenceData.recurrence_interval,
            max_occurrences: recurrenceData.max_occurrences,
            end_date: recurrenceData.end_date,
        });
    }

    return reminders;
}

function formatReminderCreatedMessage(reminderData: ReminderData): string {
    const recurrenceTypePtBr: Record<string, string> = {
        hourly: reminderData.recurrence_interval === 1 ? "hora" : "horas",
        daily: reminderData.recurrence_interval === 1 ? "dia" : "dias",
        weekly: reminderData.recurrence_interval === 1 ? "semana" : "semanas",
        monthly: reminderData.recurrence_interval === 1 ? "mês" : "meses",
        yearly: reminderData.recurrence_interval === 1 ? "ano" : "anos",
        weekday: "dia útil",
        weekend: "fim de semana",
    };

    const reminderDate = parseBrazilDateString(reminderData.date);
    const formattedDateTime = formatFriendlyDateTime(reminderDate);

    const recurrenceString =
        reminderData.recurrence_type !== "none"
            ? `, com recorrência a cada ${reminderData.recurrence_interval} ${recurrenceTypePtBr[reminderData.recurrence_type]}`
            : "";

    const extraParts: string[] = [];

    if (reminderData.end_date) {
        const endDate = parseBrazilDateString(reminderData.end_date);
        const endDateStr = endDate.toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
        extraParts.push(`até ${endDateStr}`);
    }

    if (reminderData.max_occurrences != null) {
        const plural = reminderData.max_occurrences === 1 ? "vez" : "vezes";
        extraParts.push(`máx. ${reminderData.max_occurrences} ${plural}`);
    }

    const extrasString = extraParts.length > 0 ? `, ${extraParts.join(", ")}` : "";

    return `Lembrete criado para ${formattedDateTime}${recurrenceString}${extrasString}`;
}

function formatMultipleRemindersCreatedMessage(remindersData: ReminderData[]): string {
    const recurrenceTypePtBr: Record<string, string> = {
        hourly: "hora",
        daily: "dia",
        weekly: "semana",
        monthly: "mês",
        yearly: "ano",
        weekday: "dia útil",
        weekend: "fim de semana",
    };

    const remindersText = remindersData
        .map((reminder, index) => {
            const reminderDate = parseBrazilDateString(reminder.date);
            const formattedDateTime = formatFriendlyDateTime(reminderDate);

            const recurrenceString =
                reminder.recurrence_type !== "none"
                    ? `, com recorrência a cada ${reminder.recurrence_interval} ${reminder.recurrence_interval === 1 ? recurrenceTypePtBr[reminder.recurrence_type] : recurrenceTypePtBr[reminder.recurrence_type] + "s"}`
                    : "";

            const extraParts: string[] = [];

            if (reminder.end_date) {
                const endDate = parseBrazilDateString(reminder.end_date);
                const endDateStr = endDate.toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                });
                extraParts.push(`até ${endDateStr}`);
            }

            if (reminder.max_occurrences != null) {
                const plural = reminder.max_occurrences === 1 ? "vez" : "vezes";
                extraParts.push(`máx. ${reminder.max_occurrences} ${plural}`);
            }

            const extrasString = extraParts.length > 0 ? `, ${extraParts.join(", ")}` : "";

            return `${index + 1}. *${reminder.title}* - ${formattedDateTime}${recurrenceString}${extrasString}`;
        })
        .join("\n");

    return `✅ ${remindersData.length} lembretes criados:\n\n${remindersText}`;
}
