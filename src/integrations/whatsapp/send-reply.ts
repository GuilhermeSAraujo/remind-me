
import { env } from '../../config/env';
import { CONFIG } from './client';

export interface SendReplyOptions {
  phone: string;
  messageId: string;
  message: string;
  isGroup?: boolean;
}

export async function sendReply(options: SendReplyOptions): Promise<boolean> {
  try {
    const endpoint = `${CONFIG.API_BASE_URL}/message/sendText/${CONFIG.SESSION_NAME}`;
    const response = await fetch(endpoint,
      {
        method: 'POST',
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          apikey: env.AUTHENTICATION_API_KEY,
        },
        body: JSON.stringify({
          number: options.phone,
          text: options.message,
          quoted: {
            key: {
              id: options.messageId
            }
          }
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[SEND REPLY] 🚨 API ERROR:', response.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SEND REPLY] 🚨 Unexpected ERROR:', error);
    return false;
  }
}
