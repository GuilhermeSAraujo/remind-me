import { generateContentWithContext, clearChatSession } from "../ai";
import { PROMPT_CLASSIFY_MESSAGE_INTENT } from "../ai/consts";
import { scheduleReminder, listReminders, deleteReminder } from "../reminder";
import { reactMessage, sendMessage, type UserData } from "./index";
import type { MessagePayload } from "./types";
import { HELP_MESSAGE, RATE_LIMIT_MESSAGE, RATE_LIMIT_EXCEEDED_MESSAGE } from "./consts";
import { checkRateLimit, getUserUsageStats } from "../rateLimit";

export async function processMessage(body: MessagePayload, userData: UserData) {
    const message = body.body.trim();

    const firstThreeWords = message
        .split(" ")
        .slice(0, 3)
        .join(" ")
        .toLowerCase();

    const containsReminder = /lembre|lembrar|lembrete|crie|cria/.test(firstThreeWords);
    const containsList = /lista|mostra|ver/.test(firstThreeWords);
    const containsDelete = /apaga|deleta|remove/.test(firstThreeWords);

    let messageIntent = containsReminder ? "reminder" : containsList ? "list_reminders" : containsDelete ? "delete_reminder" : null;


    console.log({ containsReminder, containsList, containsDelete, messageIntent });

    try {
        // If intent is not determined by regex, we need to use AI (classify operation)
        if (!messageIntent) {
            const rateLimitCheck = await checkRateLimit(userData.phoneNumber, 'classify');

            if (!rateLimitCheck.allowed) {
                const resetInHours = rateLimitCheck.resetIn / (1000 * 60 * 60);
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: RATE_LIMIT_EXCEEDED_MESSAGE(resetInHours),
                });
                await reactMessage(userData.messageId, "🚫");
                return;
            }

            messageIntent = await generateContentWithContext(
                userData.phoneNumber,
                PROMPT_CLASSIFY_MESSAGE_INTENT(body.body),
                'classify'
            ) as "reminder" | "list_reminders" | "delete_reminder" | "help";
        }

        switch (messageIntent) {
            case "reminder":
                // Check rate limit before creating reminder (uses AI extract)
                const rateLimitCheck = await checkRateLimit(userData.phoneNumber, 'extract');

                if (!rateLimitCheck.allowed) {
                    const resetInHours = rateLimitCheck.resetIn / (1000 * 60 * 60);
                    await sendMessage({
                        phone: userData.phoneNumber,
                        message: RATE_LIMIT_EXCEEDED_MESSAGE(resetInHours),
                    });
                    await reactMessage(userData.messageId, "🚫");
                    return;
                }

                await scheduleReminder({
                    userData,
                    message: body.body,
                    messageId: body.id
                });
                await reactMessage(userData.messageId, "✅");

                // Send warning if user is close to limit
                const stats = await getUserUsageStats(userData.phoneNumber);
                const warningMessage = RATE_LIMIT_MESSAGE(
                    stats.requestsRemaining,
                    24
                );
                if (warningMessage) {
                    await sendMessage({
                        phone: userData.phoneNumber,
                        message: warningMessage,
                    });
                }
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

