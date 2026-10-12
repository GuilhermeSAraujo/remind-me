import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSystemOne } = vi.hoisted(() => ({
    mockSystemOne: vi.fn(),
}));

vi.mock("./client", () => ({
    decisionClient: { systemOne: mockSystemOne },
}));

import { classifyDelay, delayFromAnswers } from "./classify-delay";

describe("delayFromAnswers", () => {
    const candidates = [
        { value: 30, text: "30" },
        { value: 2, text: "2" },
    ];

    it("returns the amount and unit when both answers are confident", () => {
        expect(
            delayFromAnswers(candidates, {
                unit: { choice: "minutes", confidence: 0.9 },
                amount: { choice: "30", confidence: 0.9 },
            }),
        ).toEqual({ amount: 30, unit: "minutes" });
    });

    it("returns null when either answer is unsure or missing", () => {
        expect(
            delayFromAnswers(candidates, {
                unit: { choice: "minutes", confidence: 0.59 },
                amount: { choice: "30", confidence: 0.9 },
            }),
        ).toBeNull();
        expect(
            delayFromAnswers(candidates, {
                unit: { choice: "unclear", confidence: 0.9 },
                amount: { choice: "30", confidence: 0.9 },
            }),
        ).toBeNull();
        expect(
            delayFromAnswers(candidates, {
                unit: { choice: "hours", confidence: 0.9 },
                amount: { choice: "none", confidence: 0.9 },
            }),
        ).toBeNull();
    });
});

describe("classifyDelay", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not call Jev when the message has no amount", async () => {
        await expect(classifyDelay("Adiar")).resolves.toBeNull();
        expect(mockSystemOne).not.toHaveBeenCalled();
    });

    it("asks for the unit and the extracted amount together", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                unit: { type: "choice", choice: "hours", confidence: 0.8, probabilities: {} },
                amount: { type: "choice", choice: "2", confidence: 0.8, probabilities: {} },
            },
        });

        await expect(classifyDelay("Adiar 2 horas")).resolves.toEqual({ amount: 2, unit: "hours" });
        expect(mockSystemOne).toHaveBeenCalledWith(
            expect.objectContaining({
                state: expect.objectContaining({
                    amounts: [expect.objectContaining({ id: "2", value: 2 })],
                }),
                questions: expect.objectContaining({
                    unit: expect.objectContaining({ type: "choice" }),
                    amount: expect.objectContaining({ type: "choice" }),
                }),
            }),
        );
    });
});
