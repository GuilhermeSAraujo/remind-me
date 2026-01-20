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
      // log all data from the request that is used in a single log
      console.log('[MIDDLEWARE] Request data:', {
        phoneNumber: body.from,
        sender: body.sender,
        messageId: body.id,
      });

      const phoneNumber = body.from.split("@")[0] || "";

      // Fallbacks para o nome quando o contato não está salvo
      const userName = body.sender.name
        || body.notifyName
        || body.pushname
        || phoneNumber; // Último recurso: usar o próprio número como nome

      // Log quando fallback for utilizado
      if (!body.sender.name) {
        console.log('[MIDDLEWARE] ⚠️ Contact not saved, using fallback name:', {
          fallbackName: userName,
          notifyName: body.notifyName,
          pushname: body.pushname
        });
      }

      // Use service to find or create user
      const user = await userService.findOrCreateUser(phoneNumber, userName);

      const userData: UserData = {
        phoneNumber: user.phoneNumber,
        name: user.name,
        messageId: body.id,
      };

      c.set("userData", userData);

      const messageBeginning = body.body?.trim()
        .split(" ")
        .slice(0, 3)
        .join(" ")
        .toLowerCase();

      console.log('[MIDDLEWARE]', user.name, user.phoneNumber, messageBeginning);

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

