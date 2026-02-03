import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { getRemindersInListOrder } from "./reminders-list-order.helper";

export async function listReminders({ userData }: { userData: UserData }) {
    const reminders = await getRemindersInListOrder(userData.phoneNumber);

    if (reminders.length === 0) {
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Você não tem lembretes pendentes. 📭",
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
            const dateStr = new Date(reminder.scheduledTime).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });

            const recurrenceInfo =
                reminder.recurrence_type !== "none"
                    ? ` (Repete a cada ${reminder.recurrence_interval} ${recurrenceTypePtBr[reminder.recurrence_type]})`
                    : "";

            return `${index + 1}. *${reminder.title}*\n   📅 ${dateStr}${recurrenceInfo}`;
        })
        .join("\n\n");

    const message = `📋 *Seus Lembretes Pendentes (${reminders.length})*\n\n${remindersList}\n\n💡 Você pode excluir um lembrete usando: apagar 1, deletar 2, remover 3, etc.`;

    await sendMessage({
        phone: userData.phoneNumber,
        message,
    });
}
