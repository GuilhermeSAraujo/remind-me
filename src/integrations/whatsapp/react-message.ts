import { CONFIG, getSessionToken } from "./client";

/**
 * Reacts to a WhatsApp message with an emoji
 * @param messageId - The ID of the message to react to
 * @param reaction - The emoji reaction to send
 * @returns Promise<boolean> - True if reaction was successful
 */
export async function reactMessage(messageId: string, reaction: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/react-message`,
      {
        method: "POST",
        headers: {
          accept: "*/*",
          Authorization: `Bearer ${await getSessionToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ msgId: messageId, reaction }),
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error("[REACT MESSAGE] API error:", response.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[REACT MESSAGE] Failed:", error);
    return false;
  }
}

