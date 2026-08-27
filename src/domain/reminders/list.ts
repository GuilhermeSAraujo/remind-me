import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { sendMessages } from "../../integrations/whatsapp/send-messages";
import { IReminder } from "../../domain/reminders/reminder.model";
import { nicknameForOther } from "../contacts/queries";
import { phonesMatch } from "../contacts/phone";
import {
    getRemindersCreatedForOthers,
    getRemindersInListOrder,
} from "./reminders-list-order.helper";

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

function formatScheduledDate(date: Date): string {
    return date.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

async function formatOwnedLine(
    reminder: IReminder,
    index: number,
    ownerPhone: string,
): Promise<string> {
    const dateStr = formatScheduledDate(reminder.scheduledTime);
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

    if (
        reminder.createdByPhoneNumber &&
        !phonesMatch(reminder.createdByPhoneNumber, ownerPhone)
    ) {
        const nickname = await nicknameForOther(ownerPhone, reminder.createdByPhoneNumber);
        extraParts.push(`por ${nickname ?? "contato"}`);
    }

    const extras = extraParts.length > 0 ? ` · ${extraParts.join(" · ")}` : "";
    return `${base}${extras}`;
}

async function formatCreatedForOthersBlock(
    reminders: IReminder[],
    viewerPhone: string,
): Promise<string> {
    const lines: string[] = [];
    for (const reminder of reminders) {
        const nickname =
            (await nicknameForOther(viewerPhone, reminder.userPhoneNumber)) ?? "contato";
        const dateStr = formatScheduledDate(reminder.scheduledTime);
        lines.push(`• *${reminder.title}* — para ${nickname} — ${dateStr}`);
    }

    return `📤 *Agendados para outros* (somente leitura)\n${lines.join("\n")}`;
}

const LIST_EMPTY_MESSAGES: string[] = [
    "Você não tem lembretes pendentes. 📭",
    'Para criar um: "Me lembre de comprar pão às 14h" ou "Lembrete para ir ao médico amanhã às 10h".',
];

const EMPTY_OWNED_WITH_OTHERS_HINT =
    "💡 Para apagar um lembrete seu, envie listar quando tiver lembretes próprios e use apagar 1.";

const OWNED_APAGAR_HINT =
    "💡 Você pode excluir um lembrete usando: apagar 1, deletar 2, remover 3, etc.";

export async function listReminders({ userData }: { userData: UserData }) {
    const [reminders, createdForOthers] = await Promise.all([
        getRemindersInListOrder(userData.phoneNumber),
        getRemindersCreatedForOthers(userData.phoneNumber),
    ]);

    if (reminders.length === 0 && createdForOthers.length === 0) {
        await sendMessages({
            phone: userData.phoneNumber,
            messages: LIST_EMPTY_MESSAGES,
        });
        return;
    }

    if (reminders.length === 0 && createdForOthers.length > 0) {
        const readonlyBlock = await formatCreatedForOthersBlock(
            createdForOthers,
            userData.phoneNumber,
        );
        await sendMessages({
            phone: userData.phoneNumber,
            messages: [
                "Você não tem lembretes próprios pendentes.",
                readonlyBlock,
                EMPTY_OWNED_WITH_OTHERS_HINT,
            ],
        });
        return;
    }

    const ownedLines = await Promise.all(
        reminders.map((reminder, index) =>
            formatOwnedLine(reminder, index, userData.phoneNumber),
        ),
    );
    const remindersList = ownedLines.join("\n");

    let message = `📋 *Seus Lembretes Pendentes (${reminders.length})*\n\n${remindersList}`;

    if (createdForOthers.length > 0) {
        const readonlyBlock = await formatCreatedForOthersBlock(
            createdForOthers,
            userData.phoneNumber,
        );
        message += `\n\n${readonlyBlock}`;
    }

    message += `\n\n${OWNED_APAGAR_HINT}`;

    await sendMessage({
        phone: userData.phoneNumber,
        message,
    });
}
