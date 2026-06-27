import { env } from "../../config/env";
import { CONFIG } from "./client";

export interface SendMessageOptions {
  phone: string;
  message: string;
  isGroup?: boolean;
  isNewsletter?: boolean;
}

export async function sendMessage(
  options: SendMessageOptions,
): Promise<boolean> {
  const { message } = options;

  try {
    // Evolution API endpoint for sending text messages
    const endpoint = `${CONFIG.API_BASE_URL}/message/sendText/${CONFIG.SESSION_NAME}`;


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

    await response.json();

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