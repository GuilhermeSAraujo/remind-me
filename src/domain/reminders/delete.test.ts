import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetRemindersInListOrder, mockSendMessage, mockDeleteOne } = vi.hoisted(() => ({
    mockGetRemindersInListOrder: vi.fn(),
    mockSendMessage: vi.fn(),
    mockDeleteOne: vi.fn(),
}));

vi.mock("./reminders-list-order.helper", () => ({
    getRemindersInListOrder: mockGetRemindersInListOrder,
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
}));

vi.mock("./reminder.model", () => ({
    Reminder: {
        deleteOne: mockDeleteOne,
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
            userPhoneNumber: "5511999999999",
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
            userPhoneNumber: "5511999999999",
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
