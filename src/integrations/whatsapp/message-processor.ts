import { applyInviteDecision, classifyInviteReaction, classifyInviteText } from "../../domain/contacts/invite-response";
import { listContacts } from "../../domain/contacts/list";
import {
    reminderOwnerMissingMessage,
    reminderUnknownContactMessage,
} from "../../domain/contacts/messages";
import { findLatestPendingForInvitee, findPendingByInviteMessageId } from "../../domain/contacts/queries";
import { registerContact } from "../../domain/contacts/register";
import { resolveReminderTarget } from "../../domain/contacts/resolve-reminder-target";
import { deleteReminder } from "../../domain/reminders/delete";
import { listReminders } from "../../domain/reminders/list";
import { Reminder } from "../../domain/reminders/reminder.model";
import { scheduleReminder, type ScheduleReminderTarget } from "../../domain/reminders/schedule";
import { findUserByAnyPhone } from "../../domain/users/find-user-by-phone";
import { delayReminder } from "../../domain/reminders/delay";
import { User } from "../../domain/users/user.model";
import { checkRateLimit } from "../../services/rate-limiter.service";
import { clearChatSession, generateContentWithContext } from "../ai/gemini-client";
import { PROMPT_CLASSIFY_MESSAGE_INTENT } from "../ai/gemini-constants";
import { BUY_PREMIUM_MESSAGE, FREE_USER_REMINDER_LIMIT_MESSAGE, HELP_MESSAGES, RATE_LIMIT_EXCEEDED_MESSAGE } from "./constants";
import { detectMessageIntent, type MessageIntent } from "../../domain/reminders/intent";
import { enqueueReminder } from "./reminder-queue";
import { reactMessage } from "./react-message";
import { sendMessage } from "./send-message";
import { sendMessages } from "./send-messages";
import type { MessagePayload, UserData } from "./types";

function inviteReactionEmoji(decision: "yes" | "no" | "unknown"): "✅" | "❌" {
    return decision === "no" ? "❌" : "✅";
}

export async function processMessage(body: MessagePayload, userData: UserData) {
    const reactionMessage = body.data.message.reactionMessage;
    if (reactionMessage) {
        const contact = await findPendingByInviteMessageId(
            userData.phoneNumber,
            reactionMessage.key.id,
        );
        if (!contact) {
            return;
        }
        const decision = classifyInviteReaction(reactionMessage.text);
        await applyInviteDecision({ userData, contact, decision });
        await reactMessage(userData.messageKey, inviteReactionEmoji(decision));
        return;
    }

    await reactMessage(userData.messageKey, "⏳");

    const message = body.data.message.conversation?.trim() ?? "";
    if (message.length > 250) {
        console.log("[PROCESSOR] ⚠ Message too long:", message.length);
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Infelizmente, não é possível enviar mensagens muito longas. Por favor, envie uma mensagem mais curta.",
        });
        await reactMessage(userData.messageKey, "❌");
        return;
    }

    const inviteDecision = classifyInviteText(message);
    if (inviteDecision) {
        const quotedId = body.data.contextInfo?.stanzaId;
        const contact = quotedId
            ? await findPendingByInviteMessageId(userData.phoneNumber, quotedId)
            : await findLatestPendingForInvitee(userData.phoneNumber);
        if (contact) {
            await applyInviteDecision({ userData, contact, decision: inviteDecision });
            await reactMessage(userData.messageKey, inviteReactionEmoji(inviteDecision));
            return;
        }
    }

    // Detect message intent using pattern matching (No AI)
    let messageIntent = detectMessageIntent(message);
    console.log("[PROCESSOR] ⚠ Message intent:", messageIntent);

    const shortMessage = message.length <= 3;
    if (shortMessage && !messageIntent) {
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
                await reactMessage(userData.messageKey, "❌");
                return;
            }

            messageIntent = await generateContentWithContext(
                userData.phoneNumber,
                PROMPT_CLASSIFY_MESSAGE_INTENT(message),
                'classify'
            ) as MessageIntent;
        }

        switch (messageIntent) {
            case "register_contact":
                await registerContact({ userData, message });
                await reactMessage(userData.messageKey, "✅");
                break;

            case "list_contacts":
                await listContacts({ userData });
                await reactMessage(userData.messageKey, "✅");
                break;

            case "reminder": {
                // Check if free user has reached the 5 pending reminders limit
                const user = await User.findOne({ phoneNumber: userData.phoneNumber });

                if (!user?.isPremium) {
                    const pendingRemindersCount = await Reminder.countDocuments({
                        status: "pending",
                        $or: [
                            { createdByPhoneNumber: userData.phoneNumber },
                            { createdByPhoneNumber: { $in: [null, ""] }, userPhoneNumber: userData.phoneNumber },
                            { createdByPhoneNumber: { $exists: false }, userPhoneNumber: userData.phoneNumber },
                        ],
                    });

                    if (pendingRemindersCount >= 5) {
                        await sendMessage({
                            phone: userData.phoneNumber,
                            message: FREE_USER_REMINDER_LIMIT_MESSAGE(userData.phoneNumber),
                        });
                        await reactMessage(userData.messageKey, "❌");
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
                    await reactMessage(userData.messageKey, "❌");
                    return;
                }

                const target = await resolveReminderTarget(userData.phoneNumber, message);
                if (target.kind === "unknown_name") {
                    await sendMessage({
                        phone: userData.phoneNumber,
                        message: reminderUnknownContactMessage(target.name),
                    });
                    await reactMessage(userData.messageKey, "❌");
                    break;
                }
                let scheduleTarget: ScheduleReminderTarget | undefined;
                if (target.kind === "contact") {
                    const owner = await findUserByAnyPhone(target.ownerPhoneDigits);
                    if (!owner) {
                        await sendMessage({
                            phone: userData.phoneNumber,
                            message: reminderOwnerMissingMessage(target.nickname),
                        });
                        await reactMessage(userData.messageKey, "❌");
                        break;
                    }
                    scheduleTarget = {
                        ownerPhoneNumber: owner.phoneNumber,
                        ownerNickname: target.nickname,
                        creatorDisplayName: userData.name,
                    };
                }

                // Keep ⏳ until scheduleReminder sets ✅/❌
                enqueueReminder(() =>
                    scheduleReminder({
                        userData,
                        message,
                        messageId: body.data.key.id,
                        target: scheduleTarget,
                    }),
                );

                break;
            }

            case "list_reminders":
                await listReminders({ userData });
                await reactMessage(userData.messageKey, "✅");
                break;

            case "delete_reminder": {
                const ok = await deleteReminder({
                    userData,
                    quotedMsgId: body.data.contextInfo?.stanzaId,
                    messageText: message,
                });
                await reactMessage(userData.messageKey, ok ? "✅" : "❌");
                break;
            }

            case "delay_reminder": {
                const ok = await delayReminder({
                    userData,
                    quotedMsgId: body.data.contextInfo?.stanzaId,
                    messageText: message,
                });
                await reactMessage(userData.messageKey, ok ? "✅" : "❌");
                break;
            }

            case "buy_premium":
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: BUY_PREMIUM_MESSAGE(userData.phoneNumber),
                });
                await reactMessage(userData.messageKey, "✅");
                break;

            case "thank":
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: "De nada! Estou aqui para ajudar. Se precisar de algo, é só falar!",
                });
                await reactMessage(userData.messageKey, "✅");
                break;

            case "help":
            default:
                await sendMessages({
                    phone: userData.phoneNumber,
                    messages: HELP_MESSAGES,
                });
                await reactMessage(userData.messageKey, "✅");
                break;
        }
    } catch (error) {
        console.error("[PROCESSOR] Failed:", error);
        await reactMessage(userData.messageKey, "❌");
    } finally {
        // Context only lives within the same request
        clearChatSession(userData.phoneNumber);
    }
}
