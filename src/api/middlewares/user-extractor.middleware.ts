import { Context, Next } from "hono";
import type { MessagePayload } from "../../integrations/whatsapp/types";
import qrcode from "qrcode-terminal";
import { UserService } from "../../domain/users/user.service";
import { env } from "../../config/env";
import { resolvePhoneNumber } from "../../integrations/whatsapp/resolve-phone";

export interface UserData {
  phoneNumber: string;
  name: string;
  messageId: string;
}

const userService = new UserService();

export async function extractUserData(c: Context, next: Next) {
  const body: MessagePayload = await c.req.json();
  try {
    if (body.event === "qrcode") {
      qrcode.generate(body.urlcode!, { small: true });
      return await next();
    }

    c.set("messageBody", body);

    if (!env.LOCAL_TEST_MODE && body.isGroupMsg) {
      return c.body(null, 204);
    }

    if (body.event === "onmessage" && body.sender && body.body) {
      const parts = (body.from ?? "").split("@");
      const rawNumber = parts[0] ?? "";
      const suffix = parts[1] ?? "";
      const lidNumber = suffix === "lid" ? rawNumber : undefined;
      const phoneNumber = lidNumber ? await resolvePhoneNumber(rawNumber) : rawNumber;

      // Check if local test mode is enabled
      if (env.LOCAL_TEST_MODE) {
        if (!env.LOCAL_TEST_GROUP_ID) {
          console.warn(
            "[MIDDLEWARE] 🚫 LOCAL_TEST_MODE is enabled but LOCAL_TEST_GROUP_ID is not set - blocking all messages",
          );
          return c.body(null, 204);
        } else if (body.from !== env.LOCAL_TEST_GROUP_ID) {
          console.log("[MIDDLEWARE] 🚫 Message filtered - not from test group:", body.from);
          return c.body(null, 204);
        } else {
          console.log("[MIDDLEWARE] ✅ Test mode: Processing message from test group");
        }
      }

      // Fallbacks para o nome quando o contato não está salvo
      const userName = body.sender?.name || body.notifyName || body.pushname || phoneNumber; // Último recurso: usar o próprio número como nome

      const user = await userService.findOrCreateUser(phoneNumber, userName, lidNumber);

      const userData: UserData = {
        phoneNumber: user.phoneNumber,
        name: user.name,
        messageId: body.id,
      };

      c.set("userData", userData);

      const messageBeginning = body.body?.trim().split(" ").slice(0, 3).join(" ").toLowerCase();

      console.log("[MIDDLEWARE]", user.name, user.phoneNumber, messageBeginning);

      await next();
    }

    return c.body(null, 204);
  } catch (error) {
    console.error("[MIDDLEWARE] 🚨 ERROR:", error, JSON.stringify(body, null, 2));
    return c.json(
      {
        success: false,
        message: "Invalid JSON payload",
      },
      400,
    );
  }
}
