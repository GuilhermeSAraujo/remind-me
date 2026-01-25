import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { Reminder } from "./reminder.model";

export async function listReminders({ userData }: { userData: UserData }) {
    const reminders = await Reminder.find({
        userPhoneNumber: userData.phoneNumber,
        status: "pending",
    }).sort({ scheduledTime: 1 });

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

    const message = `📋 *Seus Lembretes Pendentes (${reminders.length})*\n\n${remindersList}`;

    await sendMessage({
        phone: userData.phoneNumber,
        message,
    });
}
