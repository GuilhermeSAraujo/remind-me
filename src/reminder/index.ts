import { generateContent } from "../ai";
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
  let reminderData = await generateContent(`
        You are a helpful assistant that can help with reminders via whatsapp chat.
        You are given a message from a user and you need to EXTRACT the reminder data from the message.
        The user message is: ${message}
        Current date and time is: ${new Date().toISOString()}
        
        Extract the reminder data from the message.
        Respond ONLY with a valid json object in PLAINTEXT format with the following structure:
        {
            title string
            date string
            recurrence_type daily | weekly | monthly | yearly | none
            recurrence_interval number
        }

        Example: Me lembre de comprar pão 14h
        {
            title: "Comprar pão",
            date: "2026-01-17 14:00:00",
            recurrence_type: "none",
            recurrence_interval: 0,
        }

        Example: Me lembre de comprar pão todos os dias as 14h
        {
            title: "Comprar pão",
            date: "2026-01-17 14:00:00",
            recurrence_type: "daily",
            recurrence_interval: 1,
        }
    `);

  reminderData = reminderData.replace(/```json/g, "").replace(/```/g, "");

  return JSON.parse(reminderData);
}
