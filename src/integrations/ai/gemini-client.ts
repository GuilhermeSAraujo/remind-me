import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { env } from "../../config/env";
import { DEFAULT_AI_MODEL } from "./gemini-constants";
import { recordAIUsage } from "../../services/rate-limiter.service";

const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);

const chatSessions = new Map<string, { session: ChatSession; lastActivity: number }>();

const SESSION_TIMEOUT = 10 * 60 * 1000;

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
  operation?: 'classify' | 'extract' | 'identify_delay'
): Promise<string> {
  try {
    const session = getChatSession(userId);
    const result = await session.sendMessage(prompt);

    // Extract token usage from response metadata
    const usageMetadata = result.response.usageMetadata;
    const totalTokens = usageMetadata?.totalTokenCount || 0;

    // Record usage if operation type is provided
    if (operation) {
      await recordAIUsage(userId, operation, totalTokens);

      console.info(`[AI] (${userId.slice(-4)}) ${operation}: ${totalTokens} tokens`);
    }

    return result.response.text();
  } catch (error) {
    console.error("[AI] Generation failed:", error);
    throw error;
  }
}

export function clearChatSession(userId: string): void {
  chatSessions.delete(userId);
}

