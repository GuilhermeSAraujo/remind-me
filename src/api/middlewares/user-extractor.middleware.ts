import { Context, Next } from "hono";
import { UserService } from "../../domain/users/user.service";
import type { MessagePayload, UserData } from "../../integrations/whatsapp/types";
import {
    inboundLidJid,
    isProcessableInbound,
    resolveWebhookPhone,
} from "../../integrations/whatsapp/webhook-identity";

export type { UserData };

const userService = new UserService();

export async function extractUserData(c: Context, next: Next) {
  const payload: MessagePayload = await c.req.json();
  const data = payload.data;

  try {
    c.set("messageBody", payload);

    if (isProcessableInbound(payload)) {
      const phoneNumber = resolveWebhookPhone(data);
      const userName = data.pushName || phoneNumber;
      const user = await userService.findOrCreateUser(
        phoneNumber,
        userName,
        inboundLidJid(data),
      );

      const userData: UserData = {
        phoneNumber: user.phoneNumber,
        name: user.name,
        messageId: data.key.id,
        messageKey: {
          remoteJid: phoneNumber,
          fromMe: data.key.fromMe,
          id: data.key.id,
        },
      };

      c.set("userData", userData);

      await next();
      return;
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
