import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env";

const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);

export async function generateContent(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error generating AI content:", error);
    throw error;
  }
}
