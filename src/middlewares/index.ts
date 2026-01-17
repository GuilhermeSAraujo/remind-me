import { Context, Next } from "hono";
import type { MessagePayload } from "../whatsApp/types";
import qrcode from "qrcode-terminal";
import { IUser, User } from "../db/schemas";

export interface UserData {
  phoneNumber: string;
  name: string;
  messageId: string;
}

export async function extractUserData(c: Context, next: Next) {
  try {
    const body: MessagePayload = await c.req.json();

    if (body.event === "qrcode") {
      qrcode.generate(body.urlcode!, { small: true });
      return await next();
    }

    c.set("messageBody", body);

    console.log("Body", body);

    let user: IUser | null = null;
    if (body.event === "onmessage" && body.sender) {

      const phoneNumber = body.sender.id.split("@")[0] || "";

      user = await User.findOne({ phoneNumber });

      if (!user) {
        user = await User.create({ phoneNumber, name: body.sender.name });
      }

      const userData: UserData = {
        phoneNumber,
        name: user?.name || "",
        messageId: body.id,
      };

      c.set("userData", userData);
    }


    // request data, type, user
    console.log('[MIDDLEWARE] Request received:', {
      type: body.event,
      message: body?.body || null,
      user: {
        name: user?.name,
        phoneNumber: user?.phoneNumber,
      },
    });

    await next();
  } catch (error) {
    console.error("Error parsing message payload:", error);
    return c.json(
      {
        success: false,
        message: "Invalid JSON payload",
      },
      400
    );
  }
}
