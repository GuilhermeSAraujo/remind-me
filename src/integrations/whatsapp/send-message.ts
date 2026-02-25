import { env } from "../../config/env";
import { CONFIG, getSessionToken } from "./client";

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
  let { phone, message, isGroup = false, isNewsletter = false, isLid = true } = options;

  if (phone.length === 12) {
    isLid = false;
  }

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/send-message`, {
      method: "POST",
      headers: {
        accept: "*/*",
        Authorization: `Bearer ${await getSessionToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: env.LOCAL_TEST_MODE ? env.LOCAL_TEST_GROUP_ID : getNumber(phone, isLid),
        isGroup: !!env.LOCAL_TEST_MODE,
        isNewsletter,
        isLid: false,
        message,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[SEND MESSAGE] 🚨 API ERROR:", response.status, text, {
        phone: getNumber(phone, isLid),
        isGroup,
        isNewsletter,
        isLid,
        message,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("[SEND MESSAGE] 🚨 Unexpected ERROR:", error);
    return false;
  }
}

function getNumber(phone: string, isLid: boolean): string {
  if (isLid) {
    return `${phone}@c.us`;
  }
  return phone;
}
