import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOne, mockSort, mockFindLastFromMeMessage, mockSendMessage } = vi.hoisted(() => {
    const mockSort = vi.fn().mockResolvedValue(null);
    const mockFindOne = vi.fn().mockReturnValue({ sort: mockSort });
    return {
        mockFindOne,
        mockSort,
        mockFindLastFromMeMessage: vi.fn(),
        mockSendMessage: vi.fn(),
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

import { delayReminder } from "./delay";

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
    });
});
