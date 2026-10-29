import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateContent } = vi.hoisted(() => ({
    mockGenerateContent: vi.fn(),
}));

vi.mock("../../config/env", () => ({
    env: { GOOGLE_API_KEY: "test-key" },
}));

vi.mock("@google/generative-ai", () => ({
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
        getGenerativeModel() {
            return { generateContent: mockGenerateContent };
        }
    },
}));

import { transcribeAudio } from "./transcribe-audio";

describe("transcribeAudio", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sends the audio inline and returns only the spoken text", async () => {
        mockGenerateContent.mockResolvedValue({
            response: { text: () => "  me lembre de ir no mercado amanhã 18h  " },
        });

        await expect(
            transcribeAudio({ base64: "AAAA", mimeType: "audio/ogg" }),
        ).resolves.toBe("me lembre de ir no mercado amanhã 18h");

        expect(mockGenerateContent).toHaveBeenCalledWith([
            { inlineData: { mimeType: "audio/ogg", data: "AAAA" } },
            { text: expect.stringContaining("português brasileiro") },
        ]);
    });
});
