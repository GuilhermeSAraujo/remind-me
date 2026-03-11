import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { sendMessages } from "../../integrations/whatsapp/send-messages";
import { getRemindersInListOrder } from "./reminders-list-order.helper";

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

    const recurrenceTypePtBr: Record<string, string> = {
        hourly: "hora(s)",
        daily: "dia(s)",
        weekly: "semana(s)",
        monthly: "mês(es)",
        yearly: "ano(s)",
        weekday: "dia útil",
        weekend: "fim de semana",
        none: "",
    };

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

            if (reminder.recurrence_type !== "none") {
                extraParts.push(
                    `a cada ${reminder.recurrence_interval} ${recurrenceTypePtBr[reminder.recurrence_type]}`,
                );
            }

            if (reminder.endDate) {
                const endDateStr = reminder.endDate.toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                });
                extraParts.push(`até 31/03/2026`.replace("31/03/2026", endDateStr));
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
