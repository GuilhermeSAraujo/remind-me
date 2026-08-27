import { describe, it, expect, vi, beforeEach } from "vitest";

const {
    mockGetRemindersInListOrder,
    mockGetRemindersCreatedForOthers,
    mockSendMessage,
    mockSendMessages,
    mockNicknameForOther,
} = vi.hoisted(() => ({
    mockGetRemindersInListOrder: vi.fn(),
    mockGetRemindersCreatedForOthers: vi.fn(),
    mockSendMessage: vi.fn(),
    mockSendMessages: vi.fn(),
    mockNicknameForOther: vi.fn(),
}));

vi.mock("./reminders-list-order.helper", () => ({
    getRemindersInListOrder: mockGetRemindersInListOrder,
    getRemindersCreatedForOthers: mockGetRemindersCreatedForOthers,
}));

vi.mock("../contacts/queries", () => ({
    nicknameForOther: mockNicknameForOther,
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
}));

vi.mock("../../integrations/whatsapp/send-messages", () => ({
    sendMessages: mockSendMessages,
}));

import { listReminders } from "./list";

function allSentText(): string {
    const fromSingle = mockSendMessage.mock.calls.map((c) => c[0]!.message as string);
    const fromMulti = mockSendMessages.mock.calls.flatMap((c) => c[0]!.messages as string[]);
    return [...fromSingle, ...fromMulti].join("\n");
}

describe("listReminders – compact entries with end date and max occurrences", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRemindersCreatedForOthers.mockResolvedValue([]);
        mockNicknameForOther.mockResolvedValue(null);
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

describe("listReminders – owned + created-for-others", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRemindersCreatedForOthers.mockResolvedValue([]);
        mockNicknameForOther.mockResolvedValue(null);
    });

    it("appends · por {nickname} on owned rows created by someone else", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([
            {
                _id: "id1",
                userPhoneNumber: "5511999999999",
                createdByPhoneNumber: "5511888888888",
                title: "Passear com o cachorro",
                scheduledTime: new Date("2026-03-10T12:00:00-03:00"),
                recurrence_type: "none",
                recurrence_interval: 0,
                status: "pending",
                maxOccurrences: null,
                endDate: null,
                sentCount: 0,
            },
        ]);
        mockNicknameForOther.mockResolvedValue("Victor");

        await listReminders({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userData: { phoneNumber: "5511999999999" } as any,
        });

        const text = allSentText();
        expect(text).toContain("· por Victor");
        expect(mockNicknameForOther).toHaveBeenCalledWith("5511999999999", "5511888888888");
    });

    it("appends · por contato when creator nickname is missing", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([
            {
                _id: "id1",
                userPhoneNumber: "5511999999999",
                createdByPhoneNumber: "5511888888888",
                title: "Lembrete",
                scheduledTime: new Date("2026-03-10T12:00:00-03:00"),
                recurrence_type: "none",
                recurrence_interval: 0,
                status: "pending",
                maxOccurrences: null,
                endDate: null,
                sentCount: 0,
            },
        ]);
        mockNicknameForOther.mockResolvedValue(null);

        await listReminders({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userData: { phoneNumber: "5511999999999" } as any,
        });

        expect(allSentText()).toContain("· por contato");
    });

    it("shows readonly created-for-others block after numbered owned list", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([
            {
                _id: "owned-1",
                userPhoneNumber: "5511999999999",
                createdByPhoneNumber: "5511999999999",
                title: "Meu",
                scheduledTime: new Date("2026-03-10T08:00:00-03:00"),
                recurrence_type: "none",
                recurrence_interval: 0,
                status: "pending",
                maxOccurrences: null,
                endDate: null,
                sentCount: 0,
            },
        ]);
        mockGetRemindersCreatedForOthers.mockResolvedValue([
            {
                _id: "other-1",
                userPhoneNumber: "5511777777777",
                createdByPhoneNumber: "5511999999999",
                title: "Passear",
                scheduledTime: new Date("2026-03-11T12:00:00-03:00"),
                status: "pending",
            },
        ]);
        mockNicknameForOther.mockImplementation(async (_viewer: string, other: string) => {
            if (other === "5511777777777") return "Isabela";
            return null;
        });

        await listReminders({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userData: { phoneNumber: "5511999999999" } as any,
        });

        const text = allSentText();
        expect(text).toContain("1. *Meu*");
        expect(text).toContain("📤 *Agendados para outros* (somente leitura)");
        expect(text).toMatch(/• \*Passear\* — para Isabela —/);
        expect(text).toContain("apagar 1");
        expect(mockGetRemindersCreatedForOthers).toHaveBeenCalledWith("5511999999999");
    });

    it("when empty owned but has created-for-others, does not use only LIST_EMPTY_MESSAGES", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([]);
        mockGetRemindersCreatedForOthers.mockResolvedValue([
            {
                _id: "other-1",
                userPhoneNumber: "5511777777777",
                createdByPhoneNumber: "5511999999999",
                title: "Passear",
                scheduledTime: new Date("2026-03-11T12:00:00-03:00"),
                status: "pending",
            },
        ]);
        mockNicknameForOther.mockResolvedValue("Isabela");

        await listReminders({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userData: { phoneNumber: "5511999999999" } as any,
        });

        const text = allSentText();
        expect(text).toContain("Você não tem lembretes próprios pendentes.");
        expect(text).toContain("📤 *Agendados para outros* (somente leitura)");
        expect(text).toMatch(/• \*Passear\* — para Isabela —/);
        expect(text).toContain(
            "💡 Para apagar um lembrete seu, envie listar quando tiver lembretes próprios e use apagar 1.",
        );
        expect(text).not.toContain("Você não tem lembretes pendentes. 📭");
    });

    it("when empty owned and empty others, uses LIST_EMPTY_MESSAGES", async () => {
        mockGetRemindersInListOrder.mockResolvedValue([]);
        mockGetRemindersCreatedForOthers.mockResolvedValue([]);

        await listReminders({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userData: { phoneNumber: "5511999999999" } as any,
        });

        expect(mockSendMessages).toHaveBeenCalledWith({
            phone: "5511999999999",
            messages: [
                "Você não tem lembretes pendentes. 📭",
                'Para criar um: "Me lembre de comprar pão às 14h" ou "Lembrete para ir ao médico amanhã às 10h".',
            ],
        });
        expect(mockSendMessage).not.toHaveBeenCalled();
    });
});

describe("listReminders – recurrence labels for special monthly types", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRemindersCreatedForOthers.mockResolvedValue([]);
        mockNicknameForOther.mockResolvedValue(null);
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
