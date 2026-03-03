import { sendMessage } from "./send-message";

const DEFAULT_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SendMessagesOptions {
    phone: string;
    messages: string[];
    delayMs?: number;
}

/**
 * Sends multiple messages in sequence with a short delay between each,
 * so they appear in order and feel paced (avoids overwhelming the user).
 * Returns true if all messages were sent successfully, false on first failure.
 */
export async function sendMessages(options: SendMessagesOptions): Promise<boolean> {
    const { phone, messages, delayMs = DEFAULT_DELAY_MS } = options;

    for (let i = 0; i < messages.length; i++) {
        const ok = await sendMessage({ phone, message: messages[i]! });
        if (!ok) {
            return false;
        }
        if (i < messages.length - 1) {
            await delay(delayMs);
        }
    }

    return true;
}
