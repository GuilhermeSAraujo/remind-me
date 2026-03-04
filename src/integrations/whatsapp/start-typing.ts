import { env } from "../../config/env";
import { CONFIG, getSessionToken } from "./client";

export interface StartTypingOptions {
    phone: string;
    isGroup?: boolean;
    value?: boolean;
}

/**
 * Sends a typing indicator to a WhatsApp chat via wppconnect-server.
 * Errors are swallowed with a warning so a failed typing call never breaks the main flow.
 * No stop call is needed: WhatsApp clears the indicator automatically when a message is sent.
 */
export async function startTyping(options: StartTypingOptions): Promise<void> {
    const { isGroup = false, value = true } = options;
    const phone = env.LOCAL_TEST_MODE ? env.LOCAL_TEST_GROUP_ID! : options.phone;

    try {
        await fetch(`${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/typing`, {
            method: "POST",
            headers: {
                accept: "*/*",
                Authorization: `Bearer ${await getSessionToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                phone,
                isGroup: !!env.LOCAL_TEST_MODE || isGroup,
                value,
            }),
        });
    } catch (error) {
        console.warn("[TYPING] Failed to set typing state:", error);
    }
}
