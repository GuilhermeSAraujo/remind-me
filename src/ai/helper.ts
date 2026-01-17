import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { env } from "../env";
import { DEFAULT_AI_MODEL } from "./consts";

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

export async function generateContent(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: DEFAULT_AI_MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error generating AI content:", error);
    throw error;
  }
}

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

export async function generateContentWithContext(userId: string, prompt: string): Promise<string> {
  try {
    const session = getChatSession(userId);
    const result = await session.sendMessage(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error generating AI content with context:", error);
    throw error;
  }
}

export function clearChatSession(userId: string): void {
  chatSessions.delete(userId);
}
