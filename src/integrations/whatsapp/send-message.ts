import { env } from "../../config/env";
import { CONFIG } from "./client";

export interface SendMessageOptions {
  phone: string;
  message: string;
  isGroup?: boolean;
  isNewsletter?: boolean;
}

type SendTextResult =
  | { kind: "error" }
  | { kind: "response"; ok: boolean; id: string | null };

async function postSendText(options: SendMessageOptions): Promise<SendTextResult> {
  const { message } = options;

  try {
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

    const json = (await response.json()) as {
      key?: { id?: string };
      data?: { key?: { id?: string } };
      keyId?: string;
    };

    const id = json.key?.id ?? json.data?.key?.id ?? json.keyId ?? null;

    return { kind: "response", ok: response.ok, id };
  } catch (error) {
    console.error("[SEND MESSAGE] 🚨 Unexpected ERROR:", {
      error: error instanceof Error ? error.message : String(error),
      phone: options.phone,
      message: options.message.substring(0, 50) + "...",
    });
    return { kind: "error" };
  }
}

export async function sendMessage(
  options: SendMessageOptions,
): Promise<boolean> {
  const result = await postSendText(options);
  // Missing id (and even !response.ok) still counts as success for legacy callers.
  return result.kind !== "error";
}

export async function sendMessageGetId(
  options: SendMessageOptions,
): Promise<string | null> {
  const result = await postSendText(options);
  if (result.kind === "error" || !result.ok || !result.id) {
    return null;
  }
  return result.id;
}
