import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateContent, mockSendReply, mockSendMessage, mockReminderCreate, mockReactMessage } =
    vi.hoisted(() => ({
        mockGenerateContent: vi.fn(),
        mockSendReply: vi.fn(),
        mockSendMessage: vi.fn(),
        mockReminderCreate: vi.fn(),
        mockReactMessage: vi.fn(),
    }));

vi.mock("../../integrations/ai/gemini-client", () => ({
    generateContentWithContext: mockGenerateContent,
    getIdentificationType: () => "single-prompt",
}));

vi.mock("../../integrations/whatsapp/send-reply", () => ({
    sendReply: mockSendReply,
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
}));

vi.mock("../../integrations/whatsapp/react-message", () => ({
    reactMessage: mockReactMessage,
}));

vi.mock("./reminder.model", () => ({
    Reminder: {
        create: mockReminderCreate,
    },
}));

import { scheduleReminder } from "./schedule";

const sampleMessageKey = {
    remoteJid: "5511999999999@s.whatsapp.net",
    fromMe: false,
    id: "wamid.SAMPLE",
};

describe("scheduleReminder – confirmation messages with end date and max occurrences", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateContent.mockResolvedValue("[]");
        mockSendReply.mockResolvedValue(true);
        mockSendMessage.mockResolvedValue(true);
        mockReactMessage.mockResolvedValue(true);
    });

    it("includes end date and max occurrences in single reminder confirmation", async () => {
        mockGenerateContent.mockResolvedValue(
            JSON.stringify([
                {
                    title: "tomar remédio",
                    date: "2026-03-10 08:00",
                    recurrence_type: "none",
                    recurrence_interval: 0,
                    max_occurrences: 5,
                    end_date: "2026-03-31 10:00",
                },
            ]),
        );

        await scheduleReminder({
            userData: {
                phoneNumber: "5511999999999",
                messageId: "wamid.SAMPLE",
                name: "Test",
                messageKey: sampleMessageKey,
            },
            message: "Me lembre de tomar remédio",
            messageId: "wamid.SAMPLE",
        });

        expect(mockSendReply).toHaveBeenCalledTimes(1);
        const sent = mockSendReply.mock.calls[0]![0]!;
        expect(sent.messageId).toBe("wamid.SAMPLE");
        expect(sent.phone).toBe("5511999999999");
        expect(sent.message).toContain("até 31/03/2026");
        expect(sent.message).toContain("máx. 5 vez");
        expect(mockReactMessage).toHaveBeenCalledWith(sampleMessageKey, "✅");
    });

    it("includes end date and max occurrences per item in multiple reminders confirmation", async () => {
        const messageKey = { ...sampleMessageKey, id: "wamid.SAMPLE2" };
        mockGenerateContent.mockResolvedValue(
            JSON.stringify([
                {
                    title: "remédio manhã",
                    date: "2026-03-10 08:00",
                    recurrence_type: "daily",
                    recurrence_interval: 1,
                    end_date: "2026-03-31 08:00",
                    max_occurrences: null,
                },
                {
                    title: "remédio noite",
                    date: "2026-03-10 20:00",
                    recurrence_type: "none",
                    recurrence_interval: 0,
                    end_date: null,
                    max_occurrences: 3,
                },
            ]),
        );

        await scheduleReminder({
            userData: {
                phoneNumber: "5511999999999",
                messageId: "wamid.SAMPLE2",
                name: "Test",
                messageKey,
            },
            message: "Lembretes de remédio",
            messageId: "wamid.SAMPLE2",
        });

        expect(mockSendReply).toHaveBeenCalledTimes(1);
        const sent = mockSendReply.mock.calls[0]![0]!;
        expect(sent.messageId).toBe("wamid.SAMPLE2");
        expect(sent.phone).toBe("5511999999999");

        const text: string = sent.message;

        // First item should mention end date
        expect(text).toMatch(/1\.\s\*remédio manhã\*[\s\S]*até 31\/03\/2026/);

        // Second item should mention max occurrences
        expect(text).toMatch(/2\.\s\*remédio noite\*[\s\S]*máx\. 3 vez/);
        expect(mockReactMessage).toHaveBeenCalledWith(messageKey, "✅");
    });

    it("reacts with ❌ when extraction fails", async () => {
        mockGenerateContent.mockRejectedValue(new Error("AI down"));

        await scheduleReminder({
            userData: {
                phoneNumber: "5511999999999",
                messageId: "wamid.SAMPLE",
                name: "Test",
                messageKey: sampleMessageKey,
            },
            message: "Me lembre de algo",
            messageId: "wamid.SAMPLE",
        });

        expect(mockSendReply).not.toHaveBeenCalled();
        expect(mockReactMessage).toHaveBeenCalledWith(sampleMessageKey, "❌");
    });
});

describe("scheduleReminder – createdBy and contact target", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateContent.mockResolvedValue("[]");
        mockSendReply.mockResolvedValue(true);
        mockSendMessage.mockResolvedValue(true);
        mockReactMessage.mockResolvedValue(true);
    });

    it("sets createdByPhoneNumber equal to the owner for self reminders", async () => {
        mockGenerateContent.mockResolvedValue(
            JSON.stringify([
                {
                    title: "tomar remédio",
                    date: "2026-03-10 08:00",
                    recurrence_type: "none",
                    recurrence_interval: 0,
                },
            ]),
        );

        await scheduleReminder({
            userData: {
                phoneNumber: "5511999999999",
                messageId: "wamid.SAMPLE",
                name: "Victor",
                messageKey: sampleMessageKey,
            },
            message: "Me lembre de tomar remédio",
            messageId: "wamid.SAMPLE",
        });

        expect(mockReminderCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                userPhoneNumber: "5511999999999",
                createdByPhoneNumber: "5511999999999",
            }),
        );
        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("creates for the contact owner, confirms the scheduler, and notifies the owner", async () => {
        mockGenerateContent.mockResolvedValue(
            JSON.stringify([
                {
                    title: "passear com o cachorro",
                    date: "2026-03-10 12:00",
                    recurrence_type: "none",
                    recurrence_interval: 0,
                },
            ]),
        );

        await scheduleReminder({
            userData: {
                phoneNumber: "5511999999999",
                messageId: "wamid.SAMPLE",
                name: "Victor",
                messageKey: sampleMessageKey,
            },
            message: "Lembre a Isabela amanhã 12h de passear com o cachorro",
            messageId: "wamid.SAMPLE",
            target: {
                ownerPhoneNumber: "5511888888888",
                ownerNickname: "Isabela",
                creatorDisplayName: "Victor",
            },
        });

        expect(mockReminderCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                userPhoneNumber: "5511888888888",
                createdByPhoneNumber: "5511999999999",
            }),
        );

        expect(mockSendReply).toHaveBeenCalledTimes(1);
        const reply = mockSendReply.mock.calls[0]![0]!;
        expect(reply.phone).toBe("5511999999999");
        expect(reply.message).toContain("para Isabela");

        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        const ownerNote = mockSendMessage.mock.calls[0]![0]!;
        expect(ownerNote.phone).toBe("5511888888888");
        expect(ownerNote.message).toContain("criou um lembrete para você");
    });
});

