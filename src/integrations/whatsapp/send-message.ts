import { env } from "../../config/env";
import { CONFIG } from "./client";
// import { resolvePhoneNumber } from "./resolve-phone";

export interface SendMessageOptions {
  phone: string;
  message: string;
  isGroup?: boolean;
  isNewsletter?: boolean;
}

export async function sendMessage(
  options: SendMessageOptions,
): Promise<boolean> {
  const { message, isGroup = false, isNewsletter = false } = options;

  try {
    // Evolution API endpoint for sending text messages
    const endpoint = `${CONFIG.API_BASE_URL}/message/sendText/${CONFIG.SESSION_NAME}`;

    console.log("[SEND MESSAGE] Sending to:", {
      phone: options.phone,
      endpoint,
      message: message.substring(0, 50) + "...",
      isGroup,
      isNewsletter,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        apikey: env.AUTHENTICATION_API_KEY,
      },
      body: JSON.stringify({
        number: options.phone,
        text: message,
      }),
    });

    console.log("[SEND-MESSAGE] response payload", response)
    const body = await response.json();
    console.log("[SEND-MESSAGE] body json", body)

    return true;
  } catch (error) {
    console.error("[SEND MESSAGE] 🚨 Unexpected ERROR:", {
      error: error instanceof Error ? error.message : String(error),
      phone: options.phone,
      message: options.message.substring(0, 50) + "...",
    });
    return false;
  }
}