import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";
import { DEFAULT_AI_MODEL } from "./gemini-constants";

const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);

const TRANSCRIBE_PROMPT = `Transcreva o áudio a seguir em português brasileiro.
Devolva somente as palavras faladas, sem comentários, rótulos ou aspas.
Se não houver fala inteligível, devolva uma string vazia.`;

export async function transcribeAudio(audio: {
    base64: string;
    mimeType: string;
}): Promise<string> {
    const model = genAI.getGenerativeModel({ model: DEFAULT_AI_MODEL });
    const result = await model.generateContent([
        { inlineData: { mimeType: audio.mimeType, data: audio.base64 } },
        { text: TRANSCRIBE_PROMPT },
    ]);
    return result.response.text().trim();
}
