import { generateContentWithContext, clearChatSession } from "../ai";
import { PROMPT_CLASSIFY_MESSAGE_INTENT } from "../ai/consts";
import { scheduleReminder, listReminders, deleteReminder } from "../reminder";
import { reactMessage, sendMessage, type UserData } from "./index";
import type { MessagePayload } from "./types";
import { HELP_MESSAGE } from "./consts";

export async function processMessage(body: MessagePayload, userData: UserData) {
    const message = body.body.trim();

    const firstThreeWords = message
        .split(" ")
        .slice(0, 3)
        .join(" ")
        .toLowerCase();

    const containsReminder = /lembre|lembrar|lembrete/.test(firstThreeWords);
    const containsList = /lista|mostra|ver/.test(firstThreeWords);
    const containsDelete = /apaga|deleta|remove/.test(firstThreeWords);

    let messageIntent = containsReminder ? "reminder" : containsList ? "list_reminders" : containsDelete ? "delete_reminder" : null;


    console.log({ containsReminder, containsList, containsDelete });
    // return;

    try {
        if (!messageIntent) {
            messageIntent = await generateContentWithContext(
                userData.phoneNumber,
                PROMPT_CLASSIFY_MESSAGE_INTENT(body.body)
            ) as "reminder" | "list_reminders" | "delete_reminder" | "help";
        }

        switch (messageIntent) {
            case "reminder":
                await scheduleReminder({
                    userData,
                    message: body.body,
                    messageId: body.id
                });
                await reactMessage(userData.messageId, "✅");
                break;

            case "list_reminders":
                await listReminders({ userData });
                await reactMessage(userData.messageId, "📋");
                break;

            case "delete_reminder":
                await deleteReminder({ userData, quotedMsgId: body.quotedMsgId });
                await reactMessage(userData.messageId, "⚠");
                break;

            case "help":
            default:
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: HELP_MESSAGE,
                });
                await reactMessage(userData.messageId, "ℹ️");
                break;
        }
    } finally {
        // Context only lives within the same request
        clearChatSession(userData.phoneNumber);
    }
}

