import { Context, Next } from "hono";
import type { MessagePayload } from "../../integrations/whatsapp/types";
import qrcode from "qrcode-terminal";
import { UserService } from "../../domain/users/user.service";

export interface UserData {
  phoneNumber: string;
  name: string;
  messageId: string;
}

const userService = new UserService();

export async function extractUserData(c: Context, next: Next) {
  try {
    const body: MessagePayload = await c.req.json();

    if (body.event === "qrcode") {
      qrcode.generate(body.urlcode!, { small: true });
      return await next();
    }

    c.set("messageBody", body);

    if (body.event === "onmessage" && body.sender && body.body) {
      const phoneNumber = body.from.split("@")[0] || "";

      // Use service to find or create user
      const user = await userService.findOrCreateUser(phoneNumber, body.sender.name);

      const userData: UserData = {
        phoneNumber: user.phoneNumber,
        name: user.name,
        messageId: body.id,
      };

      c.set("userData", userData);

      console.log('[MIDDLEWARE]', user.name, user.phoneNumber);

      await next();
    }

    return c.body(null, 204);
  } catch (error) {
    console.error("[MIDDLEWARE] 🚨 ERROR:", error);
    return c.json(
      {
        success: false,
        message: "Invalid JSON payload",
      },
      400
    );
  }
}

