import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSystemOne } = vi.hoisted(() => ({
    mockSystemOne: vi.fn(),
}));

vi.mock("./client", () => ({
    decisionClient: { systemOne: mockSystemOne },
}));

import { classifyMessageIntent, intentFromChoice } from "./classify-intent";

describe("intentFromChoice", () => {
    it("returns help when confidence is below 0.5", () => {
        expect(intentFromChoice({ choice: "reminder", confidence: 0.49 })).toBe("help");
    });

    it("returns the choice when confidence is at least 0.5", () => {
        expect(intentFromChoice({ choice: "reminder", confidence: 0.5 })).toBe("reminder");
        expect(intentFromChoice({ choice: "thank", confidence: 0.9 })).toBe("thank");
    });
});

describe("classifyMessageIntent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("asks Jev about the message and applies the confidence floor", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                intent: {
                    type: "choice",
                    choice: "reminder",
                    confidence: 0.2,
                    probabilities: {},
                },
            },
        });

        await expect(classifyMessageIntent("Me lembre de pão")).resolves.toBe("help");
        expect(mockSystemOne).toHaveBeenCalledWith({
            state: { message: "Me lembre de pão" },
            questions: {
                intent: expect.objectContaining({ type: "choice" }),
            },
        });
    });

    it("returns a confident choice", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                intent: {
                    type: "choice",
                    choice: "list_contacts",
                    confidence: 0.8,
                    probabilities: {},
                },
            },
        });

        await expect(classifyMessageIntent("Contatos")).resolves.toBe("list_contacts");
    });
});
