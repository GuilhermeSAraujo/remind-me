import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSystemOne } = vi.hoisted(() => ({
    mockSystemOne: vi.fn(),
}));

vi.mock("./client", () => ({
    decisionClient: { systemOne: mockSystemOne },
}));

import { classifyMessage, inviteResponseFromAnswer } from "./classify-message";

const contacts = [{ nickname: "Isabela", otherPhoneDigits: "5531111111111" }];

function answer(choice: string, confidence: number) {
    return { type: "choice" as const, choice, confidence, probabilities: {} };
}

describe("inviteResponseFromAnswer", () => {
    it("keeps accept and reject only at or above 0.7", () => {
        expect(inviteResponseFromAnswer({ choice: "accept", confidence: 0.7 })).toBe("accept");
        expect(inviteResponseFromAnswer({ choice: "reject", confidence: 0.69 })).toBeNull();
        expect(inviteResponseFromAnswer({ choice: "unrelated", confidence: 0.9 })).toBeNull();
        expect(inviteResponseFromAnswer(undefined)).toBeNull();
    });
});

describe("classifyMessage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("asks intent, recipient and addressee, and omits the invite question when there is none", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                intent: answer("reminder", 0.9),
                recipient: answer("self", 0.9),
                addressee: answer("none", 0.9),
            },
        });

        await expect(
            classifyMessage({
                message: "Me lembre de pão",
                contacts,
                pendingInvite: false,
            }),
        ).resolves.toEqual({
            intent: "reminder",
            target: { kind: "self" },
            inviteResponse: null,
        });

        const request = mockSystemOne.mock.calls[0]![0] as {
            state: Record<string, unknown>;
            questions: Record<string, unknown>;
        };
        expect(request.state).not.toHaveProperty("pending_invite");
        expect(request.questions).not.toHaveProperty("invite_response");
        expect(request.questions).toHaveProperty("intent");
        expect(request.questions).toHaveProperty("recipient");
        expect(request.questions).toHaveProperty("addressee");
    });

    it("includes the invite question and returns accept when a pending invite exists", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                intent: answer("help", 0.4),
                recipient: answer("self", 0.2),
                addressee: answer("none", 0.2),
                invite_response: answer("accept", 0.82),
            },
        });

        await expect(
            classifyMessage({
                message: "pode sim, aceito",
                contacts,
                pendingInvite: true,
            }),
        ).resolves.toEqual({
            intent: "help",
            target: { kind: "self" },
            inviteResponse: "accept",
        });

        const request = mockSystemOne.mock.calls[0]![0] as {
            state: Record<string, unknown>;
            questions: Record<string, unknown>;
        };
        expect(request.state.pending_invite).toBe(true);
        expect(request.questions).toHaveProperty("invite_response");
    });
});
