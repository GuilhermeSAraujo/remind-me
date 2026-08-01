import { env } from "../../config/env";
import { CONFIG } from "./client";
import type { MessageKey } from "./types";

export type { MessageKey };

/**
 * Reacts to a WhatsApp message with an emoji via Evolution API.
 * Failures are logged and never thrown so callers can keep processing.
 */
export async function reactMessage(
  reactionKey: MessageKey,
  reactionMessage: string,
): Promise<boolean> {
  try {
    const endpoint = `${CONFIG.API_BASE_URL}/message/sendReaction/${CONFIG.SESSION_NAME}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        apikey: env.AUTHENTICATION_API_KEY,
      },
      body: JSON.stringify({
        reactionKey,
        reactionMessage,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[REACT MESSAGE] API error:", response.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[REACT MESSAGE] Failed:", error);
    return false;
  }
}
