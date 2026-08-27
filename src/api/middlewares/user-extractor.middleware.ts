import { Context, Next } from "hono";
import type { MessagePayload, UserData } from "../../integrations/whatsapp/types";
// import qrcode from "qrcode-terminal";
import { UserService } from "../../domain/users/user.service";
// import { env } from "../../config/env";
// import { resolvePhoneNumber } from "../../integrations/whatsapp/resolve-phone";

export type { UserData };

const userService = new UserService();

export async function extractUserData(c: Context, next: Next) {
  const payload: MessagePayload = await c.req.json();
  const data = payload.data;

  try {
    c.set("messageBody", payload);

    const isGroup = data?.key?.remoteJid?.includes("@g.us") === true;
    const isConversation =
      data?.messageType === "conversation" && Boolean(data.message?.conversation);
    const isReaction =
      data?.messageType === "reactionMessage" && Boolean(data.message?.reactionMessage);

    if (payload.event === "messages.upsert" && !isGroup && (isConversation || isReaction)) {
      const phoneNumber = data.key.remoteJid

      // Fallbacks para o nome quando o contato não está salvo
      const userName = data.pushName || phoneNumber; // Último recurso: usar o próprio número como nome

      const user = await userService.findOrCreateUser(phoneNumber, userName);

      const userData: UserData = {
        phoneNumber: user.phoneNumber,
        name: user.name,
        messageId: data.key.id,
        messageKey: {
          remoteJid: data.key.remoteJid,
          fromMe: data.key.fromMe,
          id: data.key.id,
        },
      };

      c.set("userData", userData);

      await next();
    }

    console.info("Message skipped")
    return c.body(null, 204);
  } catch (error) {
    console.error("[MIDDLEWARE] 🚨 ERROR:", error, JSON.stringify(payload, null, 2));
    return c.json(
      {
        success: false,
        message: "Invalid JSON payload",
      },
      400,
    );
  }
}
