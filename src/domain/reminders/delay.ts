import { generateContentWithContext } from "../../integrations/ai/gemini-client";
import { PROMPT_IDENTIFY_DELAY } from "../../integrations/ai/gemini-constants";
import {
    findLastFromMeMessage,
    findMessageById,
} from "../../integrations/whatsapp/find-messages";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { UserData } from "../../integrations/whatsapp/types";
import {
    formatFriendlyDateTime,
    parseBrazilDateString,
    toBrazilDateTimeString,
} from "../../shared/utils/date.utils";
import { stripReminderPrefix } from "../../shared/utils/reminder-prefix.utils";
import { Reminder } from "./reminder.model";

async function extractDelayFromMessage(
    userId: string,
    messageText: string,
): Promise<string | null> {
    try {
        let delay = await generateContentWithContext(
            userId,
            PROMPT_IDENTIFY_DELAY(messageText, toBrazilDateTimeString(new Date())),
            "identify_delay",
        );
        delay = delay.replace(/```json/g, "").replace(/```/g, "");
        return JSON.parse(delay)?.newScheduledTime ?? null;
    } catch (error) {
        console.error("[DELAY REMINDER] Failed to extract delay:", error);
        return null;
    }
}

export async function delayReminder({
    userData,
    quotedMsgId,
    messageText,
}: {
    userData: UserData;
    quotedMsgId?: string;
    messageText: string;
}) {
    const whatsappMessage = quotedMsgId
        ? await findMessageById(userData.phoneNumber, quotedMsgId)
        : await findLastFromMeMessage(userData.phoneNumber);

    if (!whatsappMessage) {
        await sendMessage({
            phone: userData.phoneNumber,
            message:
                "Não foi possível identificar o lembrete. Responda à mensagem do lembrete ou tente novamente.",
        });
        return;
    }

    const title = stripReminderPrefix(whatsappMessage.text);
    const reminder = await Reminder.findOne({
        userPhoneNumber: userData.phoneNumber,
        title,
    }).sort({ updatedAt: -1 });

    if (!reminder) {
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Lembrete não encontrado",
        });
        return;
    }

    const newScheduledTime = await extractDelayFromMessage(
        userData.phoneNumber,
        messageText,
    );

    if (!newScheduledTime) {
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Erro ao identificar o tempo de adiamento",
        });
        return;
    }

    const scheduledDate = parseBrazilDateString(newScheduledTime);
    reminder.scheduledTime = scheduledDate;
    reminder.status = "pending";
    await reminder.save();

    await sendMessage({
        phone: userData.phoneNumber,
        message: `Lembrete adiado com sucesso para ${formatFriendlyDateTime(scheduledDate)}`,
    });
}
