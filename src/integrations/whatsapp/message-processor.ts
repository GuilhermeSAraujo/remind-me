import { deleteReminder } from "../../domain/reminders/delete";
import { listReminders } from "../../domain/reminders/list";
import { Reminder } from "../../domain/reminders/reminder.model";
import { scheduleReminder } from "../../domain/reminders/schedule";
import { User } from "../../domain/users/user.model";
import { checkRateLimit } from "../../services/rate-limiter.service";
import { clearChatSession, generateContentWithContext } from "../ai/gemini-client";
import { PROMPT_CLASSIFY_MESSAGE_INTENT } from "../ai/gemini-constants";
import { BUY_PREMIUM_MESSAGE, FREE_USER_REMINDER_LIMIT_MESSAGE, HELP_MESSAGES, RATE_LIMIT_EXCEEDED_MESSAGE } from "./constants";
import { detectMessageIntent, type MessageIntent } from "./intent-detector";
import { enqueueReminder } from "./reminder-queue";
// // import { reactMessage } from "./react-message";
import { sendMessage } from "./send-message";
import { sendMessages } from "./send-messages";
import type { MessagePayload, UserData } from "./types";

export async function processMessage(body: MessagePayload, userData: UserData) {
    const message = body.data?.message.conversation.trim();
    if (message.length > 250) {
        console.log("[PROCESSOR] ⚠ Message too long:", message.length);
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Infelizmente, não é possível enviar mensagens muito longas. Por favor, envie uma mensagem mais curta.",
        });
        return;
    }

    // Detect message intent using pattern matching (No AI)
    let messageIntent = detectMessageIntent(message);

    const shortMessage = message.length <= 3;
    if (shortMessage) {
        messageIntent = "help";
    }

    if (!messageIntent) {
        console.log("[PROCESSOR] ⚠ Using AI to classify intent for message:", message.substring(0, 50));
    }

    try {
        // If intent is not determined by regex, we need to use AI (classify operation)
        if (!messageIntent) {
            const rateLimitCheck = await checkRateLimit(userData.phoneNumber, 'classify');

            if (!rateLimitCheck.allowed) {
                const resetInHours = rateLimitCheck.resetIn / (1000 * 60 * 60);
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: RATE_LIMIT_EXCEEDED_MESSAGE(resetInHours, userData.phoneNumber),
                });
                return;
            }

            messageIntent = await generateContentWithContext(
                userData.phoneNumber,
                PROMPT_CLASSIFY_MESSAGE_INTENT(message),
                'classify'
            ) as MessageIntent;
        }

        switch (messageIntent) {
            case "reminder":
                // Check if free user has reached the 5 pending reminders limit
                const user = await User.findOne({ phoneNumber: userData.phoneNumber });

                if (!user?.isPremium) {
                    const pendingRemindersCount = await Reminder.countDocuments({
                        userPhoneNumber: userData.phoneNumber,
                        status: "pending"
                    });

                    if (pendingRemindersCount >= 5) {
                        await sendMessage({
                            phone: userData.phoneNumber,
                            message: FREE_USER_REMINDER_LIMIT_MESSAGE(userData.phoneNumber),
                        });
                        return;
                    }
                }

                // Check rate limit before creating reminder (uses AI extract)
                const rateLimitCheck = await checkRateLimit(userData.phoneNumber, 'extract');

                if (!rateLimitCheck.allowed) {
                    const resetInHours = rateLimitCheck.resetIn / (1000 * 60 * 60);
                    await sendMessage({
                        phone: userData.phoneNumber,
                        message: RATE_LIMIT_EXCEEDED_MESSAGE(resetInHours, userData.phoneNumber),
                    });
                    return;
                }

                enqueueReminder(() =>
                    scheduleReminder({
                        userData,
                        message: message,
                        messageId: body.data.key.id,
                    })
                );

                break;

            case "list_reminders":
                await listReminders({ userData });
                break;

            case "delete_reminder":
                await deleteReminder({ userData, quotedMsgId: body.data.contextInfo.stanzaId, messageText: message });
                break;

            case "buy_premium":
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: BUY_PREMIUM_MESSAGE(userData.phoneNumber),
                });
                break;

            case "thank":
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: "De nada! Estou aqui para ajudar. Se precisar de algo, é só falar!",
                });
                break;

            case "help":
            default:
                await sendMessages({
                    phone: userData.phoneNumber,
                    messages: HELP_MESSAGES,
                });
                break;
        }
    } finally {
        // Context only lives within the same request
        clearChatSession(userData.phoneNumber);
    }
}

