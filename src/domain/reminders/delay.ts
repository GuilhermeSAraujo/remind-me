import { generateContentWithContext } from "../../integrations/ai/gemini-client";
import { PROMPT_IDENTIFY_DELAY } from "../../integrations/ai/gemini-constants";
import { reactMessage } from "../../integrations/whatsapp/react-message";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { UserData } from "../../integrations/whatsapp/types";
import { formatDateToBrazilianTimezone, getBrazilTime } from "../../shared/utils/date.utils";
import { findReminderByMessageIdOrTextOrLastMessage } from "./find-reminder.helper";

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
    const currentDateTime = getBrazilTime();
    const currentScheduledTime = formatDateToBrazilianTimezone(reminder.scheduledTime);

    const aiResponse = await generateContentWithContext(
        userData.phoneNumber,
        PROMPT_IDENTIFY_DELAY(userMessage, currentScheduledTime, currentDateTime),
        'identify_delay'
    );

    if (!aiResponse) {
        console.error("[DELAY REMINDER] Failed to get AI response");
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Erro ao processar o adiamento. Tente novamente com um formato válido (ex: '30 minutos', '2 dias', 'Dia 10/05 às 09:00').",
        });
        await reactMessage(userData.messageId, "🚫");
        return;
    }

    try {
        const delayData = JSON.parse(aiResponse) as { newScheduledTime: string };

        reminder.scheduledTime = new Date(delayData.newScheduledTime);
        reminder.status = "pending";
        await reminder.save();

        const formattedNewTime = formatDateToBrazilianTimezone(reminder.scheduledTime);
        await sendMessage({
            phone: userData.phoneNumber,
            message: `Lembrete "${reminder.title}" adiado com sucesso para ${formattedNewTime}.`,
        });
        await reactMessage(userData.messageId, "✅");
    } catch (error) {
        console.error("[DELAY REMINDER] Failed to parse AI response:", error);
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Erro ao processar o adiamento. Tente novamente com um formato válido (ex: '30 minutos', '2 dias', 'Dia 10/05 às 09:00').",
        });
        await reactMessage(userData.messageId, "🚫");
    }


}
