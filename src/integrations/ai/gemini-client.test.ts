import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendMessage } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
}));

vi.mock("../../config/env", () => ({
  env: { GOOGLE_API_KEY: "test-key" },
}));

vi.mock("../../services/rate-limiter.service", () => ({
  recordAIUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return {
        startChat: () => ({
          sendMessage: mockSendMessage,
        }),
      };
    }
  },
}));

import { clearChatSession, generateContentWithContext } from "./gemini-client";

describe("generateContentWithContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearChatSession("user1");
  });

  it("calls onRetry once and retries on transient 503 then succeeds", async () => {
    mockSendMessage
      .mockRejectedValueOnce(Object.assign(new Error("503"), { status: 503 }))
      .mockResolvedValueOnce({
        response: {
          text: () => "ok",
          usageMetadata: { totalTokenCount: 10 },
        },
      });

    const onRetry = vi.fn().mockResolvedValue(undefined);

    const result = await generateContentWithContext(
      "user1",
      "test prompt",
      "extract",
      onRetry
    );

    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it("does not call onRetry when first attempt succeeds", async () => {
    mockSendMessage.mockResolvedValueOnce({
      response: {
        text: () => "done",
        usageMetadata: { totalTokenCount: 5 },
      },
    });

    const onRetry = vi.fn();

    const result = await generateContentWithContext(
      "user1",
      "test",
      "extract",
      onRetry
    );

    expect(result).toBe("done");
    expect(onRetry).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it(
    "rethrows after max retries on persistent transient error",
    { timeout: 10_000 },
    async () => {
      const err = Object.assign(new Error("503"), { status: 503 });
      mockSendMessage.mockRejectedValue(err);

      const onRetry = vi.fn().mockResolvedValue(undefined);

      await expect(
        generateContentWithContext("user1", "test", "extract", onRetry)
      ).rejects.toThrow("503");

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
    }
  );

  it("rethrows immediately on non-transient error (no retry)", async () => {
    mockSendMessage.mockRejectedValueOnce(new Error("auth failed"));

    const onRetry = vi.fn();

    await expect(
      generateContentWithContext("user1", "test", undefined, onRetry)
    ).rejects.toThrow("auth failed");

    expect(onRetry).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });
});
