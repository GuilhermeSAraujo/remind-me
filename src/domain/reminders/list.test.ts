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

describe("listReminders – recurrence labels for special monthly types", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders 'toda 2ª segunda-feira do mês' for monthly_nth_weekday (nth=2, weekday=1)", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([
            {
                _id: "id1",
                userPhoneNumber: "5511999999999",
                title: "Reunião mensal",
                scheduledTime: new Date("2026-04-13T10:00:00-03:00"),
                recurrence_type: "monthly_nth_weekday",
                recurrence_interval: 1,
                recurrence_weekday: 1,
                recurrence_nth: 2,
                status: "pending",
                maxOccurrences: null,
                endDate: null,
                sentCount: 0,
            },
        ]);

        await listReminders({ userData: { phoneNumber: "5511999999999" } as any });

        const text: string = mockSendMessage.mock.calls[0]![0]!.message;
        expect(text).toContain("· toda 2ª segunda-feira do mês");
    });

    it("renders 'toda última sexta-feira do mês' for monthly_nth_weekday (nth=-1, weekday=5)", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([
            {
                _id: "id2",
                userPhoneNumber: "5511999999999",
                title: "Fechamento",
                scheduledTime: new Date("2026-04-24T10:00:00-03:00"),
                recurrence_type: "monthly_nth_weekday",
                recurrence_interval: 1,
                recurrence_weekday: 5,
                recurrence_nth: -1,
                status: "pending",
                maxOccurrences: null,
                endDate: null,
                sentCount: 0,
            },
        ]);

        await listReminders({ userData: { phoneNumber: "5511999999999" } as any });

        const text: string = mockSendMessage.mock.calls[0]![0]!.message;
        expect(text).toContain("· toda última sexta-feira do mês");
    });

    it("renders 'todo último dia útil do mês' for monthly_last_business_day", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([
            {
                _id: "id3",
                userPhoneNumber: "5511999999999",
                title: "Pagar fornecedor",
                scheduledTime: new Date("2026-03-31T17:00:00-03:00"),
                recurrence_type: "monthly_last_business_day",
                recurrence_interval: 1,
                recurrence_weekday: null,
                recurrence_nth: null,
                status: "pending",
                maxOccurrences: null,
                endDate: null,
                sentCount: 0,
            },
        ]);

        await listReminders({ userData: { phoneNumber: "5511999999999" } as any });

        const text: string = mockSendMessage.mock.calls[0]![0]!.message;
        expect(text).toContain("· todo último dia útil do mês");
    });

    it("renders 'todo primeiro dia útil do mês' for monthly_first_business_day", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([
            {
                _id: "id4",
                userPhoneNumber: "5511999999999",
                title: "Emitir nota fiscal",
                scheduledTime: new Date("2026-04-01T09:00:00-03:00"),
                recurrence_type: "monthly_first_business_day",
                recurrence_interval: 1,
                recurrence_weekday: null,
                recurrence_nth: null,
                status: "pending",
                maxOccurrences: null,
                endDate: null,
                sentCount: 0,
            },
        ]);

        await listReminders({ userData: { phoneNumber: "5511999999999" } as any });

        const text: string = mockSendMessage.mock.calls[0]![0]!.message;
        expect(text).toContain("· todo primeiro dia útil do mês");
    });
});
