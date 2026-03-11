import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetRemindersInListOrder, mockSendMessage, mockSendMessages } = vi.hoisted(() => ({
    mockGetRemindersInListOrder: vi.fn(),
    mockSendMessage: vi.fn(),
    mockSendMessages: vi.fn(),
}));

vi.mock("./reminders-list-order.helper", () => ({
    getRemindersInListOrder: mockGetRemindersInListOrder,
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
}));

vi.mock("../../integrations/whatsapp/send-messages", () => ({
    sendMessages: mockSendMessages,
}));

import { listReminders } from "./list";

describe("listReminders – compact entries with end date and max occurrences", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders a single-line entry including end date and max occurrences when present", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([
            {
                _id: "id1",
                userPhoneNumber: "5511999999999",
                title: "Tomar remédio",
                scheduledTime: new Date("2026-03-10T08:00:00-03:00"),
                recurrence_type: "daily",
                recurrence_interval: 1,
                status: "pending",
                maxOccurrences: 5,
                endDate: new Date("2026-03-31T10:00:00-03:00"),
                sentCount: 0,
            },
        ]);

        await listReminders({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userData: { phoneNumber: "5511999999999" } as any,
        });

        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        const sent = mockSendMessage.mock.calls[0]![0]!;
        const text: string = sent.message;

        // Should include the new metadata snippets
        expect(text).toContain("· até 31/03/2026");
        expect(text).toContain("· máx. 5 vez");

        // Old multi-line bullet with explicit line break between title and date should not be used anymore
        expect(text).not.toContain("\n   📅");
    });
});

