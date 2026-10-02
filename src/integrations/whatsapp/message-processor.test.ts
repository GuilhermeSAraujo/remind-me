import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IContact } from "../../domain/contacts/contact.model";
import { HELP_MESSAGES } from "./constants";
import type { MessagePayload, UserData } from "./types";

const {
    mockReactMessage,
    mockSendMessage,
    mockSendMessages,
    mockRegisterContact,
    mockListContacts,
    mockFindPendingByInviteMessageId,
    mockFindLatestPendingForInvitee,
    mockApplyInviteDecision,
    mockEnqueueReminder,
    mockCheckReminderCreationLimit,
    mockClearChatSession,
    mockResolveReminderTarget,
    mockFindUserByAnyPhone,
    mockClassifyMessageIntent,
} = vi.hoisted(() => ({
    mockReactMessage: vi.fn(),
    mockSendMessage: vi.fn(),
    mockSendMessages: vi.fn(),
    mockRegisterContact: vi.fn(),
    mockListContacts: vi.fn(),
    mockFindPendingByInviteMessageId: vi.fn(),
    mockFindLatestPendingForInvitee: vi.fn(),
    mockApplyInviteDecision: vi.fn(),
    mockEnqueueReminder: vi.fn(),
    mockCheckReminderCreationLimit: vi.fn(),
    mockClearChatSession: vi.fn(),
    mockResolveReminderTarget: vi.fn(),
    mockFindUserByAnyPhone: vi.fn(),
    mockClassifyMessageIntent: vi.fn(),
}));

vi.mock("./react-message", () => ({
    reactMessage: mockReactMessage,
}));

vi.mock("./send-message", () => ({
    sendMessage: mockSendMessage,
}));

vi.mock("./send-messages", () => ({
    sendMessages: mockSendMessages,
}));

vi.mock("./reminder-queue", () => ({
    enqueueReminder: mockEnqueueReminder,
}));

vi.mock("../ai/gemini-client", () => ({
    clearChatSession: mockClearChatSession,
}));

vi.mock("../decision-ai/classify-intent", () => ({
    classifyMessageIntent: mockClassifyMessageIntent,
}));

vi.mock("../../services/rate-limiter.service", () => ({
    checkReminderCreationLimit: mockCheckReminderCreationLimit,
}));

vi.mock("../../domain/reminders/schedule", () => ({
    scheduleReminder: vi.fn(),
}));

vi.mock("../../domain/reminders/delete", () => ({
    deleteReminder: vi.fn(),
}));

vi.mock("../../domain/reminders/list", () => ({
    listReminders: vi.fn(),
}));

vi.mock("../../domain/reminders/delay", () => ({
    delayReminder: vi.fn(),
}));

vi.mock("../../domain/contacts/register", () => ({
    registerContact: mockRegisterContact,
}));

vi.mock("../../domain/contacts/list", () => ({
    listContacts: mockListContacts,
}));

vi.mock("../../domain/contacts/queries", () => ({
    findPendingByInviteMessageId: mockFindPendingByInviteMessageId,
    findLatestPendingForInvitee: mockFindLatestPendingForInvitee,
}));

vi.mock("../../domain/contacts/invite-response", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../domain/contacts/invite-response")>();
    return {
        ...actual,
        applyInviteDecision: mockApplyInviteDecision,
    };
});

vi.mock("../../domain/contacts/resolve-reminder-target", () => ({
    resolveReminderTarget: mockResolveReminderTarget,
}));

vi.mock("../../domain/users/find-user-by-phone", () => ({
    findUserByAnyPhone: mockFindUserByAnyPhone,
}));

import { processMessage } from "./message-processor";
import { scheduleReminder } from "../../domain/reminders/schedule";

const userData: UserData = {
    phoneNumber: "5531999999999",
    name: "Victor",
    messageId: "wamid.user",
    messageKey: {
        remoteJid: "5531999999999@s.whatsapp.net",
        fromMe: false,
        id: "wamid.user",
    },
};

function pendingContact(overrides: Partial<IContact> = {}): IContact {
    return {
        inviterPhoneNumber: "5531111111111",
        inviteePhoneNumber: "5531999999999",
        inviterNicknameForInvitee: "Victor",
        inviteeNicknameForInviter: null,
        status: "pending",
        inviteMessageId: "wamid.invite",
        save: vi.fn(),
        ...overrides,
    } as unknown as IContact;
}

function conversationPayload(text: string, stanzaId?: string): MessagePayload {
    return {
        event: "messages.upsert",
        data: {
            key: {
                remoteJid: userData.messageKey.remoteJid,
                fromMe: false,
                id: userData.messageId,
            },
            pushName: userData.name,
            status: "DELIVERY_ACK",
            message: { conversation: text },
            messageType: "conversation",
            ...(stanzaId
                ? { contextInfo: { stanzaId, quotedMessage: {} } }
                : {}),
        },
    };
}

function reactionPayload(emoji: string, reactedMessageId: string): MessagePayload {
    return {
        event: "messages.upsert",
        data: {
            key: {
                remoteJid: userData.messageKey.remoteJid,
                fromMe: false,
                id: "wamid.reaction",
            },
            pushName: userData.name,
            status: "DELIVERY_ACK",
            message: {
                reactionMessage: {
                    key: {
                        remoteJid: userData.messageKey.remoteJid,
                        fromMe: true,
                        id: reactedMessageId,
                    },
                    text: emoji,
                },
            },
            messageType: "reactionMessage",
        },
    };
}

describe("processMessage – contacts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockReactMessage.mockResolvedValue(true);
        mockSendMessage.mockResolvedValue(true);
        mockSendMessages.mockResolvedValue(true);
        mockRegisterContact.mockResolvedValue(undefined);
        mockListContacts.mockResolvedValue(undefined);
        mockFindPendingByInviteMessageId.mockResolvedValue(null);
        mockFindLatestPendingForInvitee.mockResolvedValue(null);
        mockApplyInviteDecision.mockResolvedValue(undefined);
        mockCheckReminderCreationLimit.mockResolvedValue({
            allowed: true,
            remaining: 3,
            resetIn: 0,
            isPremium: false,
        });
        mockResolveReminderTarget.mockResolvedValue({ kind: "self" });
        mockFindUserByAnyPhone.mockResolvedValue(null);
        mockClassifyMessageIntent.mockResolvedValue("help");
    });

    it("applies a 👍 reaction on a pending invite and does not register a contact", async () => {
        const contact = pendingContact();
        mockFindPendingByInviteMessageId.mockResolvedValue(contact);

        await processMessage(reactionPayload("👍", "wamid.invite"), userData);

        expect(mockFindPendingByInviteMessageId).toHaveBeenCalledWith(
            userData.phoneNumber,
            "wamid.invite",
        );
        expect(mockApplyInviteDecision).toHaveBeenCalledWith({
            userData,
            contact,
            decision: "yes",
        });
        expect(mockRegisterContact).not.toHaveBeenCalled();
        expect(mockClassifyMessageIntent).not.toHaveBeenCalled();
        expect(mockReactMessage).not.toHaveBeenCalledWith(userData.messageKey, "⏳");
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "✅");
        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("ignores a reaction on an unknown message without applying or texting", async () => {
        await processMessage(reactionPayload("👍", "wamid.unknown"), userData);

        expect(mockFindPendingByInviteMessageId).toHaveBeenCalledWith(
            userData.phoneNumber,
            "wamid.unknown",
        );
        expect(mockApplyInviteDecision).not.toHaveBeenCalled();
        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(mockSendMessages).not.toHaveBeenCalled();
        expect(mockReactMessage).not.toHaveBeenCalled();
    });

    it("applies unknown decision for an unrecognized emoji on a pending invite", async () => {
        const contact = pendingContact();
        mockFindPendingByInviteMessageId.mockResolvedValue(contact);

        await processMessage(reactionPayload("😂", "wamid.invite"), userData);

        expect(mockApplyInviteDecision).toHaveBeenCalledWith({
            userData,
            contact,
            decision: "unknown",
        });
        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "✅");
    });

    it("applies a 👎 reaction on a pending invite and reacts with ❌", async () => {
        const contact = pendingContact();
        mockFindPendingByInviteMessageId.mockResolvedValue(contact);

        await processMessage(reactionPayload("👎", "wamid.invite"), userData);

        expect(mockApplyInviteDecision).toHaveBeenCalledWith({
            userData,
            contact,
            decision: "no",
        });
        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "❌");
    });

    it("applies sim against the latest pending invite", async () => {
        const contact = pendingContact();
        mockFindLatestPendingForInvitee.mockResolvedValue(contact);

        await processMessage(conversationPayload("sim"), userData);

        expect(mockFindLatestPendingForInvitee).toHaveBeenCalledWith(userData.phoneNumber);
        expect(mockApplyInviteDecision).toHaveBeenCalledWith({
            userData,
            contact,
            decision: "yes",
        });
        expect(mockRegisterContact).not.toHaveBeenCalled();
        expect(mockClassifyMessageIntent).not.toHaveBeenCalled();
        expect(mockSendMessages).not.toHaveBeenCalled();
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "⏳");
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "✅");
    });

    it("applies a 👍 message against the latest pending invite", async () => {
        const contact = pendingContact();
        mockFindLatestPendingForInvitee.mockResolvedValue(contact);

        await processMessage(conversationPayload("👍"), userData);

        expect(mockFindLatestPendingForInvitee).toHaveBeenCalledWith(userData.phoneNumber);
        expect(mockApplyInviteDecision).toHaveBeenCalledWith({
            userData,
            contact,
            decision: "yes",
        });
        expect(mockRegisterContact).not.toHaveBeenCalled();
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "✅");
    });

    it("applies sim against the quoted pending invite message", async () => {
        const contact = pendingContact();
        mockFindPendingByInviteMessageId.mockResolvedValue(contact);

        await processMessage(conversationPayload("sim", "wamid.invite"), userData);

        expect(mockFindPendingByInviteMessageId).toHaveBeenCalledWith(
            userData.phoneNumber,
            "wamid.invite",
        );
        expect(mockFindLatestPendingForInvitee).not.toHaveBeenCalled();
        expect(mockApplyInviteDecision).toHaveBeenCalledWith({
            userData,
            contact,
            decision: "yes",
        });
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "✅");
    });

    it("falls back to the latest pending invite when quoted stanzaId is not an invite", async () => {
        const contact = pendingContact();
        mockFindPendingByInviteMessageId.mockResolvedValue(null);
        mockFindLatestPendingForInvitee.mockResolvedValue(contact);

        await processMessage(conversationPayload("sim", "wamid.unrelated"), userData);

        expect(mockFindPendingByInviteMessageId).toHaveBeenCalledWith(
            userData.phoneNumber,
            "wamid.unrelated",
        );
        expect(mockFindLatestPendingForInvitee).toHaveBeenCalledWith(userData.phoneNumber);
        expect(mockApplyInviteDecision).toHaveBeenCalledWith({
            userData,
            contact,
            decision: "yes",
        });
        expect(mockSendMessages).not.toHaveBeenCalled();
    });

    it("applies sim from an extendedTextMessage against the latest pending invite", async () => {
        const contact = pendingContact();
        mockFindLatestPendingForInvitee.mockResolvedValue(contact);

        await processMessage(
            {
                event: "messages.upsert",
                data: {
                    key: {
                        remoteJid: userData.messageKey.remoteJid,
                        fromMe: false,
                        id: userData.messageId,
                    },
                    pushName: userData.name,
                    status: "DELIVERY_ACK",
                    message: { extendedTextMessage: { text: "sim" } },
                    messageType: "extendedTextMessage",
                },
            },
            userData,
        );

        expect(mockFindLatestPendingForInvitee).toHaveBeenCalledWith(userData.phoneNumber);
        expect(mockApplyInviteDecision).toHaveBeenCalledWith({
            userData,
            contact,
            decision: "yes",
        });
    });

    it("does not treat 'sim, me lembre de pão' as an invite reply", async () => {
        mockFindLatestPendingForInvitee.mockResolvedValue(pendingContact());
        mockClassifyMessageIntent.mockResolvedValue("reminder");

        await processMessage(conversationPayload("sim, me lembre de pão"), userData);

        expect(mockApplyInviteDecision).not.toHaveBeenCalled();
        expect(mockEnqueueReminder).toHaveBeenCalledOnce();
    });

    it("registers a contact for Cadastrar pessoa", async () => {
        const message = "Cadastrar pessoa (31)999999999 Victor";
        mockClassifyMessageIntent.mockResolvedValue("register_contact");

        await processMessage(conversationPayload(message), userData);

        expect(mockRegisterContact).toHaveBeenCalledWith({ userData, message });
        expect(mockListContacts).not.toHaveBeenCalled();
        expect(mockApplyInviteDecision).not.toHaveBeenCalled();
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "✅");
    });

    it("lists contacts for Contatos", async () => {
        mockClassifyMessageIntent.mockResolvedValue("list_contacts");

        await processMessage(conversationPayload("Contatos"), userData);

        expect(mockListContacts).toHaveBeenCalledWith({ userData });
        expect(mockRegisterContact).not.toHaveBeenCalled();
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "✅");
    });

    it("falls through to help when sim has no pending invite", async () => {
        mockFindLatestPendingForInvitee.mockResolvedValue(null);

        await processMessage(conversationPayload("sim"), userData);

        expect(mockFindLatestPendingForInvitee).toHaveBeenCalledWith(userData.phoneNumber);
        expect(mockApplyInviteDecision).not.toHaveBeenCalled();
        expect(mockClassifyMessageIntent).toHaveBeenCalledWith("sim");
        expect(mockSendMessages).toHaveBeenCalledWith({
            phone: userData.phoneNumber,
            messages: HELP_MESSAGES,
        });
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "✅");
    });
});

describe("processMessage – reminder target and quota", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockReactMessage.mockResolvedValue(true);
        mockSendMessage.mockResolvedValue(true);
        mockSendMessages.mockResolvedValue(true);
        mockFindPendingByInviteMessageId.mockResolvedValue(null);
        mockFindLatestPendingForInvitee.mockResolvedValue(null);
        mockCheckReminderCreationLimit.mockResolvedValue({
            allowed: true,
            remaining: 3,
            resetIn: 0,
            isPremium: false,
        });
        mockResolveReminderTarget.mockResolvedValue({ kind: "self" });
        mockFindUserByAnyPhone.mockResolvedValue(null);
        mockClassifyMessageIntent.mockResolvedValue("reminder");
    });

    it("does not enqueue when Lembre a Maria targets an unknown contact", async () => {
        mockResolveReminderTarget.mockResolvedValue({ kind: "unknown_name", name: "Maria" });

        await processMessage(
            conversationPayload("Lembre a Maria amanhã 12h de passear com o cachorro"),
            userData,
        );

        expect(mockEnqueueReminder).not.toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: userData.phoneNumber,
            message: expect.stringContaining("Não encontrei Maria"),
        });
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "❌");
    });

    it("enqueues scheduleReminder with target when contact owner User exists", async () => {
        mockResolveReminderTarget.mockResolvedValue({
            kind: "contact",
            nickname: "Isabela",
            ownerPhoneDigits: "5511888888888",
        });
        mockFindUserByAnyPhone.mockResolvedValue({ phoneNumber: "5511888888888" });

        const message = "Lembre a Isabela amanhã 12h de passear com o cachorro";
        await processMessage(conversationPayload(message), userData);

        expect(mockFindUserByAnyPhone).toHaveBeenCalledWith("5511888888888");
        expect(mockEnqueueReminder).toHaveBeenCalledOnce();
        const queued = mockEnqueueReminder.mock.calls[0]![0] as () => Promise<void>;
        await queued();

        expect(scheduleReminder).toHaveBeenCalledWith({
            userData,
            message,
            messageId: userData.messageId,
            target: {
                ownerPhoneNumber: "5511888888888",
                ownerNickname: "Isabela",
                creatorDisplayName: "Victor",
            },
        });
        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(mockReactMessage).not.toHaveBeenCalledWith(userData.messageKey, "❌");
    });

    it("rejects contact target when owner User is missing", async () => {
        mockResolveReminderTarget.mockResolvedValue({
            kind: "contact",
            nickname: "Isabela",
            ownerPhoneDigits: "5511888888888",
        });
        mockFindUserByAnyPhone.mockResolvedValue(null);

        await processMessage(
            conversationPayload("Lembre a Isabela amanhã 12h de passear com o cachorro"),
            userData,
        );

        expect(mockFindUserByAnyPhone).toHaveBeenCalledWith("5511888888888");
        expect(mockEnqueueReminder).not.toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: userData.phoneNumber,
            message: expect.stringContaining("ainda não conversou"),
        });
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "❌");
    });

    it("checks the daily creation limit and enqueues when the user is under it", async () => {
        await processMessage(conversationPayload("Me lembre de pão"), userData);

        expect(mockClassifyMessageIntent).toHaveBeenCalledWith("Me lembre de pão");
        expect(mockCheckReminderCreationLimit).toHaveBeenCalledWith(userData.phoneNumber);
        expect(mockEnqueueReminder).toHaveBeenCalledOnce();
    });

    it("does not enqueue when the daily creation limit is already reached", async () => {
        mockCheckReminderCreationLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            resetIn: 60 * 60 * 1000,
            isPremium: false,
        });

        await processMessage(conversationPayload("Me lembre de pão"), userData);

        expect(mockCheckReminderCreationLimit).toHaveBeenCalledWith(userData.phoneNumber);
        expect(mockEnqueueReminder).not.toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: userData.phoneNumber,
            message: expect.stringContaining("24 horas"),
        });
        expect(mockReactMessage).toHaveBeenCalledWith(userData.messageKey, "❌");
    });
});
