import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOne, mockSort, mockFindLastFromMeMessage, mockSendMessage, mockClassifyDelay } = vi.hoisted(() => {
    const mockSort = vi.fn().mockResolvedValue(null);
    const mockFindOne = vi.fn().mockReturnValue({ sort: mockSort });
    return {
        mockFindOne,
        mockSort,
        mockFindLastFromMeMessage: vi.fn(),
        mockSendMessage: vi.fn(),
        mockClassifyDelay: vi.fn(),
    };
});

vi.mock("./reminder.model", () => ({
    Reminder: { findOne: mockFindOne },
}));

vi.mock("../../integrations/whatsapp/find-messages", () => ({
    findLastFromMeMessage: mockFindLastFromMeMessage,
    findMessageById: vi.fn(),
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
}));

vi.mock("../../integrations/decision-ai/classify-delay", () => ({
    classifyDelay: mockClassifyDelay,
}));

import { applyDelay, delayReminder } from "./delay";

const digits = "5511999999999";
const jid = `${digits}@s.whatsapp.net`;

describe("delayReminder phone variants", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindOne.mockReturnValue({ sort: mockSort });
        mockSort.mockResolvedValue(null);
        mockFindLastFromMeMessage.mockResolvedValue({ text: "Passar fio dental" });
        mockSendMessage.mockResolvedValue(true);
    });

    it("looks up a reminder stored as a WhatsApp JID when the user phone is digits", async () => {
        const found = await delayReminder({
            userData: {
                phoneNumber: digits,
                name: "Guilherme",
                messageId: "wamid.1",
                messageKey: { remoteJid: jid, fromMe: false, id: "wamid.1" },
            },
            messageText: "adiar para amanhã",
        });

        expect(found).toBe(false);
        expect(mockFindOne).toHaveBeenCalledWith({
            userPhoneNumber: { $in: expect.arrayContaining([digits, jid]) },
            title: "Passar fio dental",
        });
        expect(mockClassifyDelay).not.toHaveBeenCalled();
    });
});

describe("applyDelay", () => {
    const now = new Date("2026-01-20T17:00:00.000Z");

    it("adds minutes, hours, and calendar days in code", () => {
        expect(applyDelay(now, 30, "minutes").toISOString()).toBe("2026-01-20T17:30:00.000Z");
        expect(applyDelay(now, 2, "hours").toISOString()).toBe("2026-01-20T19:00:00.000Z");
        expect(applyDelay(now, 2, "days").toISOString()).toBe("2026-01-22T17:00:00.000Z");
    });
});

describe("delayReminder scheduling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindOne.mockReturnValue({ sort: mockSort });
        mockSendMessage.mockResolvedValue(true);
        mockFindLastFromMeMessage.mockResolvedValue({ text: "Comprar pão" });
    });

    it("saves the time Jev's amount and unit produce", async () => {
        const reminder = {
            title: "Comprar pão",
            scheduledTime: new Date("2026-01-20T12:00:00.000Z"),
            status: "sent",
            save: vi.fn().mockResolvedValue(undefined),
        };
        mockSort.mockResolvedValue(reminder);
        mockClassifyDelay.mockResolvedValue({ amount: 30, unit: "minutes" });
        const before = Date.now();

        const result = await delayReminder({
            userData: {
                phoneNumber: digits,
                name: "Guilherme",
                messageId: "wamid.1",
                messageKey: { remoteJid: jid, fromMe: false, id: "wamid.1" },
            },
            messageText: "Adiar 30 minutos",
        });

        expect(result).toBe(true);
        expect(reminder.status).toBe("pending");
        expect(reminder.save).toHaveBeenCalled();
        const delta = reminder.scheduledTime.getTime() - before;
        expect(delta).toBeGreaterThanOrEqual(29 * 60 * 1000);
        expect(delta).toBeLessThanOrEqual(31 * 60 * 1000);
    });

    it("asks for an example when the delay is not understood", async () => {
        mockSort.mockResolvedValue({
            title: "Comprar pão",
            save: vi.fn(),
        });
        mockClassifyDelay.mockResolvedValue(null);

        const result = await delayReminder({
            userData: {
                phoneNumber: digits,
                name: "Guilherme",
                messageId: "wamid.1",
                messageKey: { remoteJid: jid, fromMe: false, id: "wamid.1" },
            },
            messageText: "Adiar",
        });

        expect(result).toBe(false);
        expect(mockSendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('Exemplo: "Adiar 30 minutos"'),
            }),
        );
    });
});
