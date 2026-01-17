import { CONFIG, getSessionToken } from "./config.js";

export interface SendMessageOptions {
  phone: string;
  message: string;
  isGroup?: boolean;
  isNewsletter?: boolean;
  isLid?: boolean;
}

/**
 * Sends a message via WhatsApp API
 * @param options - Message sending options
 * @returns Promise<boolean> - True if message was sent successfully
 */
export async function sendMessage(options: SendMessageOptions): Promise<boolean> {
  const { phone, message, isGroup = false, isNewsletter = false, isLid = false } = options;

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/send-message`, {
      method: "POST",
      headers: {
        accept: "*/*",
        Authorization: `Bearer ${await getSessionToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone,
        isGroup,
        isNewsletter,
        isLid,
        message,
      }),
    });


    if (!response.ok) {
      const text = await response.text();
      console.error("[SEND MESSAGE] Failed to send message:", response.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[SEND MESSAGE] Error sending message:", error);
    return false;
  }
}
