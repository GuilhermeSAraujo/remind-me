import { env } from "../../config/env";
import { CONFIG } from "./client";

export interface DownloadedAudio {
    base64: string;
    mimeType: string;
}

function normalizeAudioMimeType(mimeType: string | undefined): string {
    const base = (mimeType ?? "audio/ogg").split(";")[0]?.trim().toLowerCase();
    return base || "audio/ogg";
}

function stripDataUrl(value: string): string {
    if (value.startsWith("data:")) {
        const comma = value.indexOf(",");
        if (comma !== -1) {
            return value.slice(comma + 1);
        }
    }
    return value;
}

export async function downloadAudio(messageId: string): Promise<DownloadedAudio | null> {
    try {
        const response = await fetch(
            `${CONFIG.API_BASE_URL}/chat/getBase64FromMediaMessage/${CONFIG.SESSION_NAME}`,
            {
                method: "POST",
                headers: {
                    accept: "application/json",
                    "Content-Type": "application/json",
                    apikey: env.AUTHENTICATION_API_KEY,
                },
                body: JSON.stringify({
                    message: { key: { id: messageId } },
                    convertToMp4: false,
                }),
            },
        );

        if (!response.ok) {
            const text = await response.text();
            console.error("[DOWNLOAD MEDIA] API ERROR:", response.status, text);
            return null;
        }

        const data = (await response.json()) as { base64?: string; mimetype?: string };
        const raw = data.base64?.trim();
        if (!raw) {
            return null;
        }

        return {
            base64: stripDataUrl(raw),
            mimeType: normalizeAudioMimeType(data.mimetype),
        };
    } catch (error) {
        console.error("[DOWNLOAD MEDIA] Unexpected ERROR:", error);
        return null;
    }
}
