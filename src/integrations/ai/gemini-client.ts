import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { env } from "../../config/env";
import { DEFAULT_AI_MODEL } from "./gemini-constants";
import { recordAIUsage } from "../../services/rate-limiter.service";
import { AIOperationType } from "../../shared/types/ai.types";

const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);

const chatSessions = new Map<string, { session: ChatSession; lastActivity: number }>();

const SESSION_TIMEOUT = 10 * 60 * 1000;

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const RETRY_MULTIPLIER = 2;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  return typeof status === "number" && TRANSIENT_STATUS.has(status);
}

let identificationType: "single-prompt" | "multi-prompt" = "multi-prompt"

export function getIdentificationType(): "single-prompt" | "multi-prompt" {
  return identificationType;
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of chatSessions.entries()) {
    if (now - data.lastActivity > SESSION_TIMEOUT) {
      chatSessions.delete(userId);
    }
  }
}, SESSION_TIMEOUT);

export function getChatSession(userId: string): ChatSession {
  const existing = chatSessions.get(userId);

  if (existing) {
    existing.lastActivity = Date.now();
    return existing.session;
  }

  const model = genAI.getGenerativeModel({ model: DEFAULT_AI_MODEL });
  const session = model.startChat({
    history: [],
  });

  chatSessions.set(userId, {
    session,
    lastActivity: Date.now(),
  });

  return session;
}

export interface AIResponse {
  text: string;
  tokensUsed: number;
}

export async function generateContentWithContext(
  userId: string,
  prompt: string,
  operation?: AIOperationType,
  onRetry?: (attempt: number) => void | Promise<void>
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const session = getChatSession(userId);
      const result = await session.sendMessage(prompt);

      const usageMetadata = result.response.usageMetadata;
      const totalTokens = usageMetadata?.totalTokenCount || 0;

      if (operation) {
        await recordAIUsage(userId, operation, totalTokens);
        console.info(`[AI] (${userId.slice(-4)}) ${operation}: ${totalTokens} tokens`);
      }

      return result.response.text();
    } catch (error) {
      lastError = error;
      console.error("[AI] Generation failed:", error);

      if (attempt < MAX_RETRIES && isTransientError(error)) {
        if (attempt === 1 && onRetry) {
          await Promise.resolve(onRetry(attempt));
        }
        const waitMs = BASE_DELAY_MS * RETRY_MULTIPLIER ** (attempt - 1);
        await delay(waitMs);
        continue;
      }

      throw error;
    }
  }
  throw lastError;
}

export function clearChatSession(userId: string): void {
  chatSessions.delete(userId);
}

