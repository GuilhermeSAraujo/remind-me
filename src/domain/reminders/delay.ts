import { generateContentWithContext } from "../../integrations/ai/gemini-client";
import { PROMPT_IDENTIFY_DELAY } from "../../integrations/ai/gemini-constants";
import { reactMessage } from "../../integrations/whatsapp/react-message";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { UserData } from "../../integrations/whatsapp/types";
import { formatDateToBrazilianTimezone, formatFriendlyDateTime } from "../../shared/utils/date.utils";
import { findReminderByMessageIdOrTextOrLastMessage } from "./find-reminder.helper";

interface DelayData {
    newScheduledTime: string;
}

async function extractDelayData(
    userMessage: string,
    currentScheduledTime: string,
    userId: string
): Promise<DelayData> {
    let delayData = await generateContentWithContext(
        userId,
        PROMPT_IDENTIFY_DELAY(userMessage, currentScheduledTime),
        'identify_delay'
    );

    delayData = delayData.replace(/```json/g, "").replace(/```/g, "");

    return JSON.parse(delayData) as DelayData;
}

export async function delayReminder({ userMessage, userData, quotedMsgId }: { userMessage: string, userData: UserData, quotedMsgId?: string }) {
    const reminder = await findReminderByMessageIdOrTextOrLastMessage(userData.phoneNumber, quotedMsgId);

    if (!reminder) {
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Não foi possível encontrar seu lembrete a ser adiado.",
        });
        return;
    }

    if (userMessage?.trim().length === 1) {
        // add 5 minutes to the scheduled time
        reminder.scheduledTime = new Date(reminder.scheduledTime.getTime() + 5 * 60 * 1000);
        reminder.status = "pending";
        await reminder.save();

        await sendMessage({
            phone: userData.phoneNumber,
            message: `Lembrete adiado com sucesso para daqui 5 minutos.`,
        });
        await reactMessage(userData.messageId, "✅");
        return;
    }

    // send it to AI to extract the delay
    const currentScheduledTime = formatDateToBrazilianTimezone(reminder.scheduledTime);

    try {
        const delayData = await extractDelayData(
            userMessage,
            currentScheduledTime,
            userData.phoneNumber
        );

        reminder.scheduledTime = new Date(delayData.newScheduledTime);
        reminder.status = "pending";
        await reminder.save();

        const formattedNewTime = formatFriendlyDateTime(reminder.scheduledTime);
        await sendMessage({
            phone: userData.phoneNumber,
            message: `Lembrete "${reminder.title}" adiado com sucesso para ${formattedNewTime}.`,
        });
        await reactMessage(userData.messageId, "✅");
    } catch (error) {
        console.error("[DELAY REMINDER] Failed to extract or parse delay data:", error);
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Erro ao processar o adiamento. Tente novamente com um formato válido (ex: '30 minutos', '2 dias', 'Dia 10/05 às 09:00').",
        });
        await reactMessage(userData.messageId, "🚫");
    }


}
