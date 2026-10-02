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
import { scheduleReminder, type ScheduleReminderTarget } from "../../domain/reminders/schedule";
import { findUserByAnyPhone } from "../../domain/users/find-user-by-phone";
import { delayReminder } from "../../domain/reminders/delay";
import { checkReminderCreationLimit } from "../../services/rate-limiter.service";
import { clearChatSession } from "../ai/gemini-client";
import { classifyMessageIntent } from "../decision-ai/classify-intent";
import { BUY_PREMIUM_MESSAGE, HELP_MESSAGES, RATE_LIMIT_EXCEEDED_MESSAGE } from "./constants";
import { enqueueReminder } from "./reminder-queue";
import { reactMessage } from "./react-message";
import { sendMessage } from "./send-message";
import { sendMessages } from "./send-messages";
import { inboundMessageText } from "./webhook-identity";
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

    const message = inboundMessageText(body.data);
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
            ? (await findPendingByInviteMessageId(userData.phoneNumber, quotedId))
                ?? (await findLatestPendingForInvitee(userData.phoneNumber))
            : await findLatestPendingForInvitee(userData.phoneNumber);
        if (contact) {
            await applyInviteDecision({ userData, contact, decision: inviteDecision });
            await reactMessage(userData.messageKey, inviteReactionEmoji(inviteDecision));
            return;
        }
    }

    try {
        const messageIntent = await classifyMessageIntent(message);
        console.log("[PROCESSOR] ⚠ Message intent:", messageIntent);

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
                const creationLimit = await checkReminderCreationLimit(userData.phoneNumber);

                if (!creationLimit.allowed) {
                    const resetInHours = creationLimit.resetIn / (1000 * 60 * 60);
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
