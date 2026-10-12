import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSystemOne } = vi.hoisted(() => ({
    mockSystemOne: vi.fn(),
}));

vi.mock("./client", () => ({
    decisionClient: { systemOne: mockSystemOne },
}));

import {
    DELETE_CONFIDENCE_FLOOR,
    classifyDeleteTarget,
    deleteTargetFromAnswer,
} from "./classify-delete-target";

const reminders = [
    { title: "Comprar pão", scheduledTime: new Date("2026-10-13T10:00:00-03:00") },
    { title: "Ligar para o médico", scheduledTime: new Date("2026-10-14T14:00:00-03:00") },
];

describe("deleteTargetFromAnswer", () => {
    it("returns the index when confidence is at the floor", () => {
        expect(
            deleteTargetFromAnswer(2, { choice: "r1", confidence: DELETE_CONFIDENCE_FLOOR }),
        ).toBe(1);
    });

    it("returns null below the floor, for none, and for an unknown id", () => {
        expect(deleteTargetFromAnswer(2, { choice: "r0", confidence: 0.79 })).toBeNull();
        expect(deleteTargetFromAnswer(2, { choice: "none", confidence: 0.95 })).toBeNull();
        expect(deleteTargetFromAnswer(2, { choice: "r9", confidence: 0.95 })).toBeNull();
    });
});

describe("classifyDeleteTarget", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not call Jev when there are no reminders", async () => {
        await expect(classifyDeleteTarget("apagar pão", [])).resolves.toBeNull();
        expect(mockSystemOne).not.toHaveBeenCalled();
    });

    it("asks which listed reminder the message names", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                target: { type: "choice", choice: "r0", confidence: 0.91, probabilities: {} },
            },
        });

        await expect(classifyDeleteTarget("Deletar lembrete de comprar pão", reminders)).resolves.toBe(0);

        const request = mockSystemOne.mock.calls[0]![0];
        expect(request.state.reminders[0]).toEqual(
            expect.objectContaining({ id: "r0", title: "Comprar pão" }),
        );
        expect(request.state.reminders[0].when).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
        expect(request.questions.target.criteria).toEqual(
            expect.objectContaining({ r0: expect.any(Object), r1: expect.any(Object), none: expect.any(Object) }),
        );
    });

    it("returns null when Jev is not confident", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                target: { type: "choice", choice: "r0", confidence: 0.4, probabilities: {} },
            },
        });

        await expect(classifyDeleteTarget("apagar", reminders)).resolves.toBeNull();
    });
});
