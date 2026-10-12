import { describe, it, expect, vi, beforeEach } from "vitest";

const {
    mockGetRemindersInListOrder,
    mockSendMessage,
    mockDeleteOne,
    mockFindMessageById,
    mockSort,
    mockFindOne,
    mockClassifyDeleteTarget,
} = vi.hoisted(() => {
    const mockSort = vi.fn().mockResolvedValue(null);
    const mockFindOne = vi.fn().mockReturnValue({ sort: mockSort });
    return {
        mockGetRemindersInListOrder: vi.fn(),
        mockSendMessage: vi.fn(),
        mockDeleteOne: vi.fn(),
        mockFindMessageById: vi.fn(),
        mockSort,
        mockFindOne,
        mockClassifyDeleteTarget: vi.fn(),
    };
});

vi.mock("./reminders-list-order.helper", () => ({
    getRemindersInListOrder: mockGetRemindersInListOrder,
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
}));

vi.mock("../../integrations/whatsapp/find-messages", () => ({
    findMessageById: mockFindMessageById,
}));

vi.mock("../../integrations/decision-ai/classify-delete-target", () => ({
    classifyDeleteTarget: mockClassifyDeleteTarget,
}));

vi.mock("./reminder.model", () => ({
    Reminder: {
        deleteOne: mockDeleteOne,
        findOne: mockFindOne,
    },
}));

import { deleteReminder } from "./delete";

describe("deleteReminder – apagar N uses owned list only", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
        mockSendMessage.mockResolvedValue(true);
    });

    it("deletes only the owned reminder at index N; created-for-others are not in getRemindersInListOrder", async () => {
        const owned = {
            _id: "owned-1",
            userPhoneNumber: "5511999999999@s.whatsapp.net",
            createdByPhoneNumber: "5511999999999",
            title: "Meu lembrete",
            scheduledTime: new Date("2026-03-10T08:00:00-03:00"),
            status: "pending",
        };

        // Created-for-other rows must NOT appear in the owned list array
        mockGetRemindersInListOrder.mockResolvedValue([owned]);

        const result = await deleteReminder({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userData: { phoneNumber: "5511999999999" } as any,
            messageText: "apagar 1",
        });

        expect(result).toBe(true);
        expect(mockGetRemindersInListOrder).toHaveBeenCalledWith("5511999999999");
        await expect(mockGetRemindersInListOrder.mock.results[0]!.value).resolves.toEqual([owned]);
        expect(mockDeleteOne).toHaveBeenCalledWith({
            _id: "owned-1",
            userPhoneNumber: {
                $in: expect.arrayContaining([
                    "5511999999999",
                    "5511999999999@s.whatsapp.net",
                ]),
            },
        });
        expect(mockSendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('Lembrete "Meu lembrete" apagado com sucesso.'),
            }),
        );
    });

    it("rejects apagar 2 when only one owned reminder exists (created-for-others do not expand numbering)", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([
            {
                _id: "owned-1",
                userPhoneNumber: "5511999999999",
                title: "Meu lembrete",
                status: "pending",
            },
        ]);

        const result = await deleteReminder({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userData: { phoneNumber: "5511999999999" } as any,
            messageText: "apagar 2",
        });

        expect(result).toBe(false);
        expect(mockDeleteOne).not.toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining("Número inválido"),
            }),
        );
    });
});

describe("deleteReminder – quoted message and description", () => {
    const userData = { phoneNumber: "5511999999999" } as never;
    const owned = {
        _id: "owned-1",
        userPhoneNumber: "5511999999999",
        title: "Comprar pão",
        scheduledTime: new Date("2026-10-13T13:00:00.000Z"),
        status: "pending",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
        mockSendMessage.mockResolvedValue(true);
        mockFindOne.mockReturnValue({ sort: mockSort });
        mockSort.mockResolvedValue(null);
        mockGetRemindersInListOrder.mockResolvedValue([owned]);
    });

    it("deletes the reminder quoted in the bot message without calling Jev", async () => {
        mockFindMessageById.mockResolvedValue({
            id: "wamid.bot",
            text: "🔔 Lembrete: Comprar pão",
            fromMe: true,
        });
        mockSort.mockResolvedValue(owned);

        const result = await deleteReminder({
            userData,
            quotedMsgId: "wamid.bot",
            messageText: "apagar",
        });

        expect(result).toBe(true);
        expect(mockFindMessageById).toHaveBeenCalledWith("5511999999999", "wamid.bot");
        expect(mockFindOne).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Comprar pão" }),
        );
        expect(mockClassifyDeleteTarget).not.toHaveBeenCalled();
        expect(mockDeleteOne).toHaveBeenCalledWith(
            expect.objectContaining({ _id: "owned-1" }),
        );
    });

    it("deletes the reminder Jev names with high confidence", async () => {
        mockClassifyDeleteTarget.mockResolvedValue(0);

        const result = await deleteReminder({
            userData,
            messageText: "Deletar lembrete de comprar pão",
        });

        expect(result).toBe(true);
        expect(mockClassifyDeleteTarget).toHaveBeenCalledWith("Deletar lembrete de comprar pão", [
            { title: "Comprar pão", scheduledTime: owned.scheduledTime },
        ]);
        expect(mockDeleteOne).toHaveBeenCalledWith(
            expect.objectContaining({ _id: "owned-1" }),
        );
    });

    it("asks for apagar N when Jev is not confident", async () => {
        mockClassifyDeleteTarget.mockResolvedValue(null);

        const result = await deleteReminder({
            userData,
            messageText: "apagar isso",
        });

        expect(result).toBe(false);
        expect(mockDeleteOne).not.toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringMatching(/apagar N[\s\S]*1\. Comprar pão/),
            }),
        );
    });

    it("says there are no pending reminders when the list is empty", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([]);

        const result = await deleteReminder({
            userData,
            messageText: "apagar o de pão",
        });

        expect(result).toBe(false);
        expect(mockClassifyDeleteTarget).not.toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Você não tem lembretes pendentes.",
            }),
        );
    });
});
