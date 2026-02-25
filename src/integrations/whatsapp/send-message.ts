import { env } from "../../config/env";
import { CONFIG, getSessionToken } from "./client";
import { resolvePhoneNumber } from "./resolve-phone";

export interface SendMessageOptions {
  phone: string;
  message: string;
  isGroup?: boolean;
  isNewsletter?: boolean;
}

export async function sendMessage(options: SendMessageOptions): Promise<boolean> {
  const { message, isGroup = false, isNewsletter = false } = options;
  const phone = await resolvePhoneNumber(options.phone);

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/send-message`, {
      method: "POST",
      headers: {
        accept: "*/*",
        Authorization: `Bearer ${await getSessionToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: env.LOCAL_TEST_MODE ? env.LOCAL_TEST_GROUP_ID : phone,
        isGroup: !!env.LOCAL_TEST_MODE,
        isNewsletter,
        isLid: false,
        message,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[SEND MESSAGE] 🚨 API ERROR:", response.status, text, {
        phone,
        isGroup,
        isNewsletter,
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
