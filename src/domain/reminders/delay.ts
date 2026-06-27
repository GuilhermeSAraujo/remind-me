import { generateContentWithContext } from "../../integrations/ai/gemini-client";
import { PROMPT_IDENTIFY_DELAY } from "../../integrations/ai/gemini-constants";
import { getMessageById } from "../../integrations/whatsapp/get-message-by-id";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { UserData } from "../../integrations/whatsapp/types";
import { Reminder } from "./reminder.model";


async function extractDelayFromMessage(userId: string, messageText: string): Promise<number> {
    const delay = await generateContentWithContext(
        userId,
        PROMPT_IDENTIFY_DELAY(messageText),
        "identify_delay",
    );
    return JSON.parse(delay)?.newScheduledTime;
}

export async function delayReminder({ userData, quotedMsgId, messageText }: { userData: UserData; quotedMsgId: string; messageText: string }) {
    // find message
    const message = await getMessageById(quotedMsgId);
    console.log("[DELAY REMINDER] Message found:", message);
    if (!message) {
        await sendMessage({ phone: userData.phoneNumber, message: "Mensagem não encontrada" });
        return;
    }

    const reminder = await Reminder.findOne({ userPhoneNumber: userData.phoneNumber, messageId: quotedMsgId });
    console.log("[DELAY REMINDER] Searching for reminder:", { userPhoneNumber: userData.phoneNumber, messageId: quotedMsgId }, reminder);
    if (!reminder) {
        await sendMessage({ phone: userData.phoneNumber, message: "Lembrete não encontrado" });
        return;
    }

    const newScheduledTime = await extractDelayFromMessage(userData.phoneNumber, messageText);

    if (!newScheduledTime) {
        await sendMessage({ phone: userData.phoneNumber, message: "Erro ao identificar o tempo de adiamento" });
        return;
    }

    reminder.scheduledTime = new Date(newScheduledTime);
    reminder.status = "pending";
    await reminder.save();

    await sendMessage({ phone: userData.phoneNumber, message: `Lembrete adiado com sucesso para ${newScheduledTime}` });
}