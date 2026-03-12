import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFind, mockUpdateOne, mockSendMessage } = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockUpdateOne: vi.fn(),
    mockSendMessage: vi.fn(),
}));

// Mock Reminder model
vi.mock("../domain/reminders/reminder.model", () => ({
    Reminder: {
        find: mockFind,
        updateOne: mockUpdateOne,
    },
}));

// Mock sendMessage
vi.mock("../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
}));

// Mock reminder-prefix.utils
vi.mock("../shared/utils/reminder-prefix.utils", () => ({
    getRandomPrefix: () => "🔔 ",
}));

import { triggerReminders } from "./reminder-trigger.job";

function makeReminder(overrides: Record<string, unknown> = {}) {
    return {
        _id: "id1",
        userPhoneNumber: "5511999999999",
        title: "Tomar remédio",
        scheduledTime: new Date("2026-03-11T08:00:00"),
        recurrence_type: "hourly",
        recurrence_interval: 8,
        recurrence_weekday: null,
        recurrence_nth: null,
        status: "pending",
        maxOccurrences: null,
        endDate: null,
        sentCount: 0,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue(true);
});

describe("triggerReminders – end conditions", () => {
    it("increments sentCount when reminder is sent", async () => {
        mockFind.mockResolvedValue([makeReminder()]);

        await triggerReminders();

        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: "id1" },
            expect.objectContaining({ sentCount: 1 }),
        );
    });

    it("stops series and marks sent when maxOccurrences is reached after this send", async () => {
        mockFind.mockResolvedValue([makeReminder({ sentCount: 4, maxOccurrences: 5 })]);

        await triggerReminders();

        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: "id1" },
            expect.objectContaining({ status: "sent" }),
        );
        // Should NOT reschedule (no scheduledTime update)
        const call = mockUpdateOne.mock.calls[0]!;
        expect(call[1]).not.toHaveProperty("scheduledTime");
    });

    it("stops series and marks sent when nextScheduledTime would exceed endDate", async () => {
        mockFind.mockResolvedValue([
            makeReminder({
                sentCount: 1,
                endDate: new Date("2026-03-11T10:00:00"),
                // scheduledTime is 08:00, next hourly (+8h) = 16:00 which is past endDate 10:00
            }),
        ]);

        await triggerReminders();

        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: "id1" },
            expect.objectContaining({ status: "sent" }),
        );
    });

    it("reschedules normally when no end conditions are hit", async () => {
        mockFind.mockResolvedValue([makeReminder({ sentCount: 0, maxOccurrences: 5 })]);

        await triggerReminders();

        const call = mockUpdateOne.mock.calls[0]!;
        expect(call[1]).toHaveProperty("scheduledTime");
        expect(call[1]).not.toHaveProperty("status", "sent");
    });

    it("marks non-recurring reminder as sent (existing behavior preserved)", async () => {
        mockFind.mockResolvedValue([
            makeReminder({ recurrence_type: "none", recurrence_interval: 0 }),
        ]);

        await triggerReminders();

        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: "id1" },
            expect.objectContaining({ status: "sent" }),
        );
    });

    it("reschedules monthly_nth_weekday using calendar rule (first Tuesday, March → April)", async () => {
        mockFind.mockResolvedValue([
            makeReminder({
                scheduledTime: new Date("2026-03-03T10:00:00"),
                recurrence_type: "monthly_nth_weekday",
                recurrence_interval: 1,
                recurrence_weekday: 2,
                recurrence_nth: 1,
            }),
        ]);

        await triggerReminders();

        const call = mockUpdateOne.mock.calls[0]!;
        const updatedScheduledTime: Date = call[1].scheduledTime;
        // First Tuesday of April 2026 = April 7
        expect(updatedScheduledTime.getMonth()).toBe(3);  // April
        expect(updatedScheduledTime.getDate()).toBe(7);
    });

    it("reschedules monthly_last_business_day correctly (March 31 → April 30)", async () => {
        mockFind.mockResolvedValue([
            makeReminder({
                scheduledTime: new Date("2026-03-31T10:00:00"),
                recurrence_type: "monthly_last_business_day",
                recurrence_interval: 1,
                recurrence_weekday: null,
                recurrence_nth: null,
            }),
        ]);

        await triggerReminders();

        const call = mockUpdateOne.mock.calls[0]!;
        const updatedScheduledTime: Date = call[1].scheduledTime;
        expect(updatedScheduledTime.getMonth()).toBe(3); // April
        expect(updatedScheduledTime.getDate()).toBe(30);
    });
});
