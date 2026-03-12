import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { sendMessages } from "../../integrations/whatsapp/send-messages";
import { IReminder } from "../../domain/reminders/reminder.model";
import { getRemindersInListOrder } from "./reminders-list-order.helper";

const WEEKDAY_NAMES: Record<number, string> = {
    0: "domingo",
    1: "segunda-feira",
    2: "terça-feira",
    3: "quarta-feira",
    4: "quinta-feira",
    5: "sexta-feira",
    6: "sábado",
};

const NTH_ORDINALS: Record<number, string> = {
    1: "1ª",
    2: "2ª",
    3: "3ª",
    4: "4ª",
    5: "5ª",
    [-1]: "última",
};

function formatRecurrence(reminder: {
    recurrence_type: IReminder["recurrence_type"];
    recurrence_interval: number;
    recurrence_weekday: number | null;
    recurrence_nth: number | null;
}): string | null {
    switch (reminder.recurrence_type) {
        case "none":
            return null;
        case "hourly":
            return `a cada ${reminder.recurrence_interval} hora(s)`;
        case "daily":
            return `a cada ${reminder.recurrence_interval} dia(s)`;
        case "weekly":
            return `a cada ${reminder.recurrence_interval} semana(s)`;
        case "monthly":
            return `a cada ${reminder.recurrence_interval} mês(es)`;
        case "yearly":
            return `a cada ${reminder.recurrence_interval} ano(s)`;
        case "weekday":
            return "todo dia útil";
        case "weekend":
            return "todo fim de semana";
        case "monthly_last_business_day":
            return "todo último dia útil do mês";
        case "monthly_first_business_day":
            return "todo primeiro dia útil do mês";
        case "monthly_nth_weekday": {
            const nth = reminder.recurrence_nth ?? 1;
            const weekday = reminder.recurrence_weekday ?? 1;
            const ordinal = NTH_ORDINALS[nth] ?? `${nth}ª`;
            const dayName = WEEKDAY_NAMES[weekday] ?? "dia";
            return `toda ${ordinal} ${dayName} do mês`;
        }
    }
}

const LIST_EMPTY_MESSAGES: string[] = [
    "Você não tem lembretes pendentes. 📭",
    'Para criar um: "Me lembre de comprar pão às 14h" ou "Lembrete para ir ao médico amanhã às 10h".',
];

export async function listReminders({ userData }: { userData: UserData }) {
    const reminders = await getRemindersInListOrder(userData.phoneNumber);

    if (reminders.length === 0) {
        await sendMessages({
            phone: userData.phoneNumber,
            messages: LIST_EMPTY_MESSAGES,
        });
        return;
    }

    const remindersList = reminders
        .map((reminder, index) => {
            const dateStr = reminder.scheduledTime.toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });

            const base = `${index + 1}. *${reminder.title}* - ${dateStr}`;

            const extraParts: string[] = [];

            const recurrenceLabel = formatRecurrence(reminder);
            if (recurrenceLabel !== null) {
                extraParts.push(recurrenceLabel);
            }

            if (reminder.endDate) {
                const endDateStr = reminder.endDate.toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                });
                extraParts.push(`até ${endDateStr}`);
            }

            if (reminder.maxOccurrences != null) {
                const plural = reminder.maxOccurrences === 1 ? "vez" : "vezes";
                extraParts.push(`máx. ${reminder.maxOccurrences} ${plural}`);
            }

            const extras =
                extraParts.length > 0 ? ` · ${extraParts.join(" · ")}` : "";

            return `${base}${extras}`;
        })
        .join("\n");

    const message = `📋 *Seus Lembretes Pendentes (${reminders.length})*\n\n${remindersList}\n\n💡 Você pode excluir um lembrete usando: apagar 1, deletar 2, remover 3, etc.`;

    await sendMessage({
        phone: userData.phoneNumber,
        message,
    });
}
