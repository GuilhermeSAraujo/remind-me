import { applyInviteDecision, classifyInviteReaction, classifyInviteText } from "../../domain/contacts/invite-response";
import { listContacts } from "../../domain/contacts/list";
import {
    reminderOwnerMissingMessage,
    reminderUnknownContactMessage,
} from "../../domain/contacts/messages";
import {
    findAcceptedContactsForUser,
    findLatestPendingForInvitee,
    findPendingByInviteMessageId,
} from "../../domain/contacts/queries";
import { registerContact } from "../../domain/contacts/register";
import {
    resolveReminderTarget,
    type ReminderTarget,
} from "../../domain/contacts/resolve-reminder-target";
import { deleteReminder } from "../../domain/reminders/delete";
import { listReminders } from "../../domain/reminders/list";
import { scheduleReminder, type ScheduleReminderTarget } from "../../domain/reminders/schedule";
import { findUserByAnyPhone } from "../../domain/users/find-user-by-phone";
import { delayReminder } from "../../domain/reminders/delay";
import { checkReminderCreationLimit } from "../../services/rate-limiter.service";
import { clearChatSession } from "../ai/gemini-client";
import { transcribeAudio } from "../ai/transcribe-audio";
import { classifyMessage } from "../decision-ai/classify-message";
import { BUY_PREMIUM_MESSAGE, HELP_MESSAGES, RATE_LIMIT_EXCEEDED_MESSAGE } from "./constants";
import { downloadAudio } from "./download-media";
import { enqueueReminder } from "./reminder-queue";
import { reactMessage } from "./react-message";
import { sendMessage } from "./send-message";
import { sendMessages } from "./send-messages";
import {
    inboundAudioSeconds,
    inboundMessageText,
    isAudioInbound,
    MAX_AUDIO_SECONDS,
} from "./webhook-identity";
import type { MessagePayload, UserData } from "./types";

const TEXT_TOO_LONG_MESSAGE =
    "Infelizmente, não é possível enviar mensagens muito longas. Por favor, envie uma mensagem mais curta.";
const AUDIO_TOO_LONG_MESSAGE =
    "Infelizmente, não é possível enviar áudios muito longos. Por favor, envie um áudio de até 1 minuto.";
const AUDIO_UNHEARD_MESSAGE =
    "Não consegui ouvir o áudio. Tente novamente ou envie o lembrete por texto.";
const AUDIO_NOT_UNDERSTOOD_MESSAGE =
    "Não consegui entender o áudio. Tente novamente ou envie o lembrete por texto.";
const MAX_MESSAGE_LENGTH = 250;

function inviteReactionEmoji(decision: "yes" | "no" | "unknown"): "✅" | "❌" {
    return decision === "no" ? "❌" : "✅";
}

async function rejectIfOverQuota(userData: UserData): Promise<boolean> {
    const creationLimit = await checkReminderCreationLimit(userData.phoneNumber);
    if (creationLimit.allowed) {
        return false;
    }

    const resetInHours = creationLimit.resetIn / (1000 * 60 * 60);
    await sendMessage({
        phone: userData.phoneNumber,
        message: RATE_LIMIT_EXCEEDED_MESSAGE(resetInHours, userData.phoneNumber),
    });
    await reactMessage(userData.messageKey, "❌");
    return true;
}

async function enqueueScheduledReminder({
    userData,
    message,
    messageId,
    decidedTarget,
}: {
    userData: UserData;
    message: string;
    messageId: string;
    decidedTarget?: ReminderTarget;
}) {
    const target = await resolveReminderTarget(
        userData.phoneNumber,
        message,
        decidedTarget,
    );
    if (target.kind === "unknown_name") {
        await sendMessage({
            phone: userData.phoneNumber,
            message: reminderUnknownContactMessage(target.name),
        });
        await reactMessage(userData.messageKey, "❌");
        return;
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
            return;
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
            messageId,
            target: scheduleTarget,
        }),
    );
}

async function processAudioReminder(body: MessagePayload, userData: UserData) {
    const seconds = inboundAudioSeconds(body.data);
    if (seconds !== undefined && seconds > MAX_AUDIO_SECONDS) {
        await sendMessage({
            phone: userData.phoneNumber,
            message: AUDIO_TOO_LONG_MESSAGE,
        });
        await reactMessage(userData.messageKey, "❌");
        return;
    }

    if (await rejectIfOverQuota(userData)) {
        return;
    }

    enqueueReminder(async () => {
        try {
            const media = await downloadAudio(body.data.key.id);
            if (!media) {
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: AUDIO_UNHEARD_MESSAGE,
                });
                await reactMessage(userData.messageKey, "❌");
                return;
            }

            const transcript = (await transcribeAudio(media)).trim();
            if (!transcript) {
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: AUDIO_NOT_UNDERSTOOD_MESSAGE,
                });
                await reactMessage(userData.messageKey, "❌");
                return;
            }
            if (transcript.length > MAX_MESSAGE_LENGTH) {
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: TEXT_TOO_LONG_MESSAGE,
                });
                await reactMessage(userData.messageKey, "❌");
                return;
            }

            await enqueueScheduledReminder({
                userData,
                message: transcript,
                messageId: body.data.key.id,
                decidedTarget: undefined,
            });
        } catch (error) {
            console.error("[PROCESSOR] Audio failed:", error);
            await sendMessage({
                phone: userData.phoneNumber,
                message: AUDIO_NOT_UNDERSTOOD_MESSAGE,
            });
            await reactMessage(userData.messageKey, "❌");
        }
    });
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

    if (isAudioInbound(body.data)) {
        await processAudioReminder(body, userData);
        return;
    }

    const message = inboundMessageText(body.data);
    if (message.length > MAX_MESSAGE_LENGTH) {
        console.log("[PROCESSOR] ⚠ Message too long:", message.length);
        await sendMessage({
            phone: userData.phoneNumber,
            message: TEXT_TOO_LONG_MESSAGE,
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
        const contacts = await findAcceptedContactsForUser(userData.phoneNumber);
        const pendingInvite = await findLatestPendingForInvitee(userData.phoneNumber);
        const classified = await classifyMessage({
            message,
            contacts,
            pendingInvite: pendingInvite != null,
        });
        if (classified.inviteResponse && pendingInvite) {
            const decision = classified.inviteResponse === "accept" ? "yes" : "no";
            await applyInviteDecision({ userData, contact: pendingInvite, decision });
            await reactMessage(userData.messageKey, inviteReactionEmoji(decision));
            return;
        }

        const messageIntent = classified.intent;
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
                if (await rejectIfOverQuota(userData)) {
                    return;
                }
                await enqueueScheduledReminder({
                    userData,
                    message,
                    messageId: body.data.key.id,
                    decidedTarget: classified.target,
                });
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
