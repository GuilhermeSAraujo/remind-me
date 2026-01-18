import { Context, Next } from "hono";
import type { MessagePayload } from "../whatsApp/types";
import qrcode from "qrcode-terminal";
import { IUser, Reminder, User } from "../db/schemas";

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

    let user: IUser | null = null;
    if (body.event === "onmessage" && body.sender && body.body) {

      // const phoneNumber = body.sender.id.split("@")[0] || "";
      const from = body.from.split("@")[0] || "";

      user = await User.findOne({ phoneNumber: from });

      if (!user) {
        const userExistWithWrongPhoneNumber = await User.findOne({ name: body.sender.name });
        if (userExistWithWrongPhoneNumber) {
          const updatedReminders = await Reminder.updateMany({ userPhoneNumber: userExistWithWrongPhoneNumber.phoneNumber }, { userPhoneNumber: from });
          console.log('[MIDDLEWARE] FIX: Updated reminders:', updatedReminders);

          userExistWithWrongPhoneNumber.phoneNumber = from;
          await userExistWithWrongPhoneNumber.save();
          console.log('[MIDDLEWARE] FIX: Updated user:', userExistWithWrongPhoneNumber);

          user = userExistWithWrongPhoneNumber;
        } else {
          user = await User.create({ phoneNumber: from, name: body.sender.name });
        }
      }

      const userData: UserData = {
        phoneNumber: user?.phoneNumber || "",
        name: user?.name || "",
        messageId: body.id,
      };

      c.set("userData", userData);

      // request data, type, user
      console.log('[MIDDLEWARE] Request received:', {
        type: body.event,
        message: body?.body || null,
        user: {
          name: user?.name,
          phoneNumber: user?.phoneNumber || "",
        },
      });

      await next();
    }

    return c.body(null, 204);
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
