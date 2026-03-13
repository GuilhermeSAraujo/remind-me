import { env } from '../../config/env';
import { CONFIG, getSessionToken } from './client';
import { resolvePhoneNumber } from './resolve-phone';

export interface SendReplyOptions {
  phone: string;
  messageId: string;
  message: string;
  isGroup?: boolean;
}

export async function sendReply(options: SendReplyOptions): Promise<boolean> {
  const phone = env.LOCAL_TEST_MODE
    ? env.LOCAL_TEST_GROUP_ID!
    : await resolvePhoneNumber(options.phone);

  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/send-reply`,
      {
        method: 'POST',
        headers: {
          accept: '*/*',
          Authorization: `Bearer ${await getSessionToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          isGroup: !!env.LOCAL_TEST_MODE,
          message: options.message,
          messageId: options.messageId,
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
