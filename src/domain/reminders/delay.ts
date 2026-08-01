import { generateContentWithContext } from "../../integrations/ai/gemini-client";
import { PROMPT_IDENTIFY_DELAY } from "../../integrations/ai/gemini-constants";
import {
    findLastFromMeMessage,
    findMessageById,
} from "../../integrations/whatsapp/find-messages";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { UserData } from "../../integrations/whatsapp/types";
import { stripReminderPrefix } from "../../shared/utils/reminder-prefix.utils";
import { Reminder } from "./reminder.model";

async function extractDelayFromMessage(
    userId: string,
    messageText: string,
): Promise<string | null> {
    try {
        const delay = await generateContentWithContext(
            userId,
            PROMPT_IDENTIFY_DELAY(messageText),
            "identify_delay",
        );
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

    console.log("[DELAY REMINDER] Message found:", whatsappMessage);
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

    console.log(
        "[DELAY REMINDER] Searching for reminder:",
        { userPhoneNumber: userData.phoneNumber, title },
        reminder,
    );
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

    reminder.scheduledTime = new Date(newScheduledTime);
    reminder.status = "pending";
    await reminder.save();

    await sendMessage({
        phone: userData.phoneNumber,
        message: `Lembrete adiado com sucesso para ${newScheduledTime}`,
    });
}
