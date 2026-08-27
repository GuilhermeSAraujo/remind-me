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
    buildBrazilWeekdayDateLookup,
    buildBrazilWeekdayPromptExample,
    buildBrazilWeekdayPromptExampleBase,
    parseBrazilDateString,
    toBrazilDateTimeString,
    truncateToMinute,
} from "../../shared/utils/date.utils";
import { sendReply } from "../../integrations/whatsapp/send-reply";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { reactMessage } from "../../integrations/whatsapp/react-message";
import { stripContactTarget } from "../contacts/resolve-reminder-target";
import {
    reminderCreatedForOtherSuffix,
    reminderCreatedForYouMessage,
} from "../contacts/messages";

const MESSAGE_AI_TEMPORARY_ERROR =
    "Ocorreu um erro temporário. Seu lembrete será processado assim que a IA voltar.";
import { calculateNextScheduledTime } from "./recurrence.utils";

export type ScheduleReminderTarget = {
    ownerPhoneNumber: string;
    ownerNickname: string;
    creatorDisplayName: string;
};

export async function scheduleReminder({
    userData,
    message,
    messageId,
    target,
}: {
    userData: UserData;
    message: string;
    messageId: string;
    target?: ScheduleReminderTarget;
}) {
    try {
        const onRetry = () => {
            void sendReply({
                phone: userData.phoneNumber,
                messageId: userData.messageId,
                message: MESSAGE_AI_TEMPORARY_ERROR,
            });
        };
        const extractMessage = target
            ? stripContactTarget(message, target.ownerNickname)
            : message;
        const remindersData = await extractReminderData(extractMessage, userData.phoneNumber, onRetry);

        if (remindersData.length === 0) {
            await reactMessage(userData.messageKey, "❌");
            return;
        }

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
                    { weekday: reminderData.recurrence_weekday, nth: reminderData.recurrence_nth },
                );
            }

            scheduledTime = truncateToMinute(scheduledTime);

            await Reminder.create({
                messageId: messageId,
                userPhoneNumber: target?.ownerPhoneNumber ?? userData.phoneNumber,
                createdByPhoneNumber: userData.phoneNumber,
                title: capitalizeTitle(reminderData.title),
                scheduledTime: scheduledTime,
                recurrence_type: reminderData.recurrence_type,
                recurrence_interval: reminderData.recurrence_interval,
                recurrence_weekday: reminderData.recurrence_weekday ?? null,
                recurrence_nth: reminderData.recurrence_nth ?? null,
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

        const creatorMessage = target
            ? `${successMessage}${reminderCreatedForOtherSuffix(target.ownerNickname)}`
            : successMessage;

        await sendReply({
            phone: userData.phoneNumber,
            messageId: userData.messageId,
            message: creatorMessage,
        });

        if (target) {
            await sendMessage({
                phone: target.ownerPhoneNumber,
                message: formatOwnerCreatedMessage(target.creatorDisplayName, remindersData),
            });
        }

        await reactMessage(userData.messageKey, "✅");
    } catch (error) {
        console.error("[SCHEDULE REMINDER] Failed:", error);
        await reactMessage(userData.messageKey, "❌");
    }
}

interface ReminderData {
    title: string;
    date: string;
    recurrence_type:
        | "hourly" | "daily" | "weekly" | "monthly" | "yearly"
        | "weekday" | "weekend"
        | "monthly_nth_weekday"
        | "monthly_last_business_day"
        | "monthly_first_business_day"
        | "none";
    recurrence_interval: number;
    recurrence_weekday: number | null;
    recurrence_nth: number | null;
    max_occurrences?: number | null;
    end_date?: string | null;
}

function capitalizeTitle(title: string): string {
    return title.charAt(0).toUpperCase() + title.slice(1);
}

function formatOwnerCreatedMessage(creatorDisplayName: string, remindersData: ReminderData[]): string {
    if (remindersData.length === 1) {
        const reminder = remindersData[0]!;
        return reminderCreatedForYouMessage(
            creatorDisplayName,
            capitalizeTitle(reminder.title),
            formatFriendlyDateTime(parseBrazilDateString(reminder.date)),
        );
    }

    const list = formatMultipleRemindersCreatedMessage(remindersData);
    return `${creatorDisplayName} criou lembretes para você.\n${list}\nEles são seus: você pode apagar ou adiar. Envie listar para ver.`;
}

interface BaseReminderData {
    title: string;
    date: string;
}

interface RecurrenceData {
    recurrence_type: ReminderData["recurrence_type"];
    recurrence_interval: number;
    recurrence_weekday: number | null;
    recurrence_nth: number | null;
    max_occurrences: number | null;
    end_date: string | null;
}

const RECURRENCE_FALLBACK: RecurrenceData = {
    recurrence_type: "none",
    recurrence_interval: 0,
    recurrence_weekday: null,
    recurrence_nth: null,
    max_occurrences: null,
    end_date: null,
};

async function extractReminderData(
    message: string,
    userId: string,
    onRetry?: (attempt: number) => void | Promise<void>,
): Promise<ReminderData[]> {
    if (getIdentificationType() === "multi-prompt") {
        return extractReminderDataMultiPrompt(message, userId, onRetry);
    }

    const now = new Date();
    let reminderData = await generateContentWithContext(
        userId,
        PROMPT_EXTRACT_REMINDER_DATA(
            message,
            toBrazilDateTimeString(now),
            getBrazilWeekday(now),
            buildBrazilWeekdayDateLookup(now),
            buildBrazilWeekdayPromptExample(now),
        ),
        "extract",
        onRetry,
    );
    reminderData = reminderData.replace(/```json/g, "").replace(/```/g, "");
    return JSON.parse(reminderData) as ReminderData[];
}

async function extractReminderDataMultiPrompt(
    message: string,
    userId: string,
    onRetry?: (attempt: number) => void | Promise<void>,
): Promise<ReminderData[]> {
    const now = new Date();
    // Step 1: extract base fields (title + date only)
    let baseRaw = await generateContentWithContext(
        userId,
        PROMPT_EXTRACT_REMINDER_BASE(
            message,
            toBrazilDateTimeString(now),
            getBrazilWeekday(now),
            buildBrazilWeekdayDateLookup(now),
            buildBrazilWeekdayPromptExampleBase(now),
        ),
        "extract",
        onRetry,
    );
    baseRaw = baseRaw.replace(/```json/g, "").replace(/```/g, "");
    const baseReminders = JSON.parse(baseRaw) as BaseReminderData[];

    // Step 2: extract recurrence for each reminder (reuses same chat session context)
    const reminders: ReminderData[] = [];
    for (const base of baseReminders) {
        let recurrenceData: RecurrenceData = RECURRENCE_FALLBACK;
        try {
            let recurrenceRaw = await generateContentWithContext(
                userId,
                PROMPT_EXTRACT_RECURRENCE(message, base.title, base.date),
                "extract",
                onRetry,
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
            recurrence_weekday: recurrenceData.recurrence_weekday ?? null,
            recurrence_nth: recurrenceData.recurrence_nth ?? null,
            max_occurrences: recurrenceData.max_occurrences,
            end_date: recurrenceData.end_date,
        });
    }

    return reminders;
}

const CALENDAR_RULE_TYPES = [
    "monthly_nth_weekday",
    "monthly_last_business_day",
    "monthly_first_business_day",
] as const;

function formatCalendarRuleRecurrence(reminderData: ReminderData): string {
    const ORDINALS: Record<number, string> = {
        1: "primeira", 2: "segunda", 3: "terceira", 4: "quarta", 5: "quinta", [-1]: "última",
    };
    const WEEKDAYS: Record<number, string> = {
        0: "domingo", 1: "segunda-feira", 2: "terça-feira",
        3: "quarta-feira", 4: "quinta-feira", 5: "sexta-feira", 6: "sábado",
    };

    switch (reminderData.recurrence_type) {
        case "monthly_nth_weekday": {
            const ord = ORDINALS[reminderData.recurrence_nth ?? 1] ?? "primeira";
            const wd = WEEKDAYS[reminderData.recurrence_weekday ?? 1] ?? "segunda-feira";
            return `toda ${ord} ${wd} do mês`;
        }
        case "monthly_last_business_day":
            return "todo último dia útil do mês";
        case "monthly_first_business_day":
            return "todo primeiro dia útil do mês";
        default:
            return "";
    }
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

    const isCalendarRule = (CALENDAR_RULE_TYPES as readonly string[]).includes(reminderData.recurrence_type);

    const recurrenceString =
        reminderData.recurrence_type === "none"
            ? ""
            : isCalendarRule
            ? `, com recorrência ${formatCalendarRuleRecurrence(reminderData)}`
            : `, com recorrência a cada ${reminderData.recurrence_interval} ${recurrenceTypePtBr[reminderData.recurrence_type]}`;

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

            const isCalendarRule = (CALENDAR_RULE_TYPES as readonly string[]).includes(reminder.recurrence_type);

            const recurrenceString =
                reminder.recurrence_type === "none"
                    ? ""
                    : isCalendarRule
                    ? `, com recorrência ${formatCalendarRuleRecurrence(reminder)}`
                    : `, com recorrência a cada ${reminder.recurrence_interval} ${reminder.recurrence_interval === 1 ? recurrenceTypePtBr[reminder.recurrence_type] : recurrenceTypePtBr[reminder.recurrence_type] + "s"}`;

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
