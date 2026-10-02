import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSystemOne } = vi.hoisted(() => ({
    mockSystemOne: vi.fn(),
}));

vi.mock("./client", () => ({
    decisionClient: { systemOne: mockSystemOne },
}));

import {
    addresseeTokenCandidates,
    classifyReminderTarget,
} from "./classify-reminder-target";

const contacts = [{ nickname: "Isabela", otherPhoneDigits: "5531111111111" }];

describe("addresseeTokenCandidates", () => {
    it("keeps a nickname that is followed by a comma", () => {
        expect(
            addresseeTokenCandidates("Lembre a Isabela, amanhã 12h de passear com o cachorro"),
        ).toContain("Isabela");
    });

    it("drops function words and punctuation", () => {
        expect(addresseeTokenCandidates("Avisa a Isa, amanhã")).toEqual([
            "Avisa",
            "Isa",
            "amanhã",
        ]);
    });
});

describe("classifyReminderTarget", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("asks Jev who receives the reminder and which word names someone else", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                recipient: {
                    type: "choice",
                    choice: "c0",
                    confidence: 0.2,
                    probabilities: {},
                },
                addressee: {
                    type: "choice",
                    choice: "Isa",
                    confidence: 0.8,
                    probabilities: {},
                },
            },
        });

        await expect(classifyReminderTarget("Avisa a Isa amanhã", contacts)).resolves.toEqual({
            kind: "self",
        });

        expect(mockSystemOne).toHaveBeenCalledWith({
            state: {
                message: "Avisa a Isa amanhã",
                contacts: [{ id: "c0", nickname: "Isabela" }],
            },
            questions: {
                recipient: expect.objectContaining({
                    type: "choice",
                    criteria: expect.objectContaining({
                        self: expect.anything(),
                        c0: expect.anything(),
                        other: expect.anything(),
                    }),
                }),
                addressee: expect.objectContaining({
                    type: "choice",
                    criteria: expect.objectContaining({
                        Avisa: expect.anything(),
                        Isa: expect.anything(),
                        amanhã: expect.anything(),
                        none: expect.anything(),
                    }),
                }),
            },
        });
    });

    it("returns the roster contact for a confident choice", async () => {
        mockSystemOne.mockResolvedValue({
            answers: {
                recipient: {
                    type: "choice",
                    choice: "c0",
                    confidence: 0.8,
                    probabilities: {},
                },
                addressee: {
                    type: "choice",
                    choice: "none",
                    confidence: 0.8,
                    probabilities: {},
                },
            },
        });

        await expect(
            classifyReminderTarget("Lembre a Isabela amanhã 12h de passear", contacts),
        ).resolves.toEqual({
            kind: "contact",
            nickname: "Isabela",
            ownerPhoneDigits: "5531111111111",
        });
    });
});
