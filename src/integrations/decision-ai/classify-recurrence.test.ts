import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSystemOne } = vi.hoisted(() => ({
    mockSystemOne: vi.fn(),
}));

vi.mock("./client", () => ({
    decisionClient: { systemOne: mockSystemOne },
}));

import { classifyRecurrence } from "./classify-recurrence";

function choice(value: string) {
    return { type: "choice" as const, choice: value, confidence: 0.9, probabilities: {} };
}

function yesNo(noul: number) {
    return { type: "noul" as const, noul };
}

describe("classifyRecurrence", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not call Jev when there are no reminders", async () => {
        await expect(classifyRecurrence("todo dia", [])).resolves.toEqual([]);
        expect(mockSystemOne).not.toHaveBeenCalled();
    });

    it("asks every reminder's recurrence in one request", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                r0_type: choice("daily"),
                r0_weekday: choice("none"),
                r0_nth: choice("none"),
                r0_interval: choice("not_stated"),
                r0_max_occurrences: choice("none"),
                r0_end: choice("none"),
                r0_end_amount: choice("none"),
                r0_every_day: yesNo(0.9),
                r0_sub_hour: yesNo(0.05),
                r1_type: choice("none"),
                r1_weekday: choice("none"),
                r1_nth: choice("none"),
                r1_interval: choice("not_stated"),
                r1_max_occurrences: choice("none"),
                r1_end: choice("none"),
                r1_end_amount: choice("none"),
                r1_every_day: yesNo(0.05),
                r1_sub_hour: yesNo(0.05),
            },
        });

        const result = await classifyRecurrence(
            "Lavar louça todo dia às 14h e comprar pão amanhã às 10h",
            [
                { title: "Lavar louça", date: "2026-01-21 14:00:00" },
                { title: "Comprar pão", date: "2026-01-22 10:00:00" },
            ],
        );

        expect(result[0]).toMatchObject({ fallback: false, data: { recurrence_type: "daily" } });
        expect(result[1]).toMatchObject({ fallback: false, data: { recurrence_type: "none" } });
        const questions = mockSystemOne.mock.calls[0]![0].questions;
        expect(questions.r0_type.type).toBe("choice");
        expect(questions.r1_sub_hour.type).toBe("noul");
        expect(mockSystemOne).toHaveBeenCalledTimes(1);
    });
});
