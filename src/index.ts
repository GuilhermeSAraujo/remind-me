import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
  reactMessage,
  sendMessage,
  extractUserData,
  type MessagePayload,
  type UserData,
} from "./whatsApp";
import { generateContent } from "./ai";
import { PROMPT_CLASSIFY_MESSAGE_INTENT } from "./ai/consts";
import { scheduleReminder, listReminders, deleteReminder } from "./reminder";
import { startSession } from "./whatsApp/config";
import "./db";
import "./crons";
import { HELP_MESSAGE } from "./whatsApp/consts";

type Variables = {
  messageBody: MessagePayload;
  userData?: UserData;
};

await startSession();

const app = new Hono<{ Variables: Variables }>();

app.post("/message", extractUserData, async (c) => {
  const body = c.get("messageBody");
  const userData = c.get("userData");

  if (body?.event !== "onmessage" || !userData) {
    return c.json({}, 200);
  }

  await reactMessage(userData.messageId, "⏳");

  const messageIntent = await generateContent(PROMPT_CLASSIFY_MESSAGE_INTENT(body.body)) as "reminder" | "list_reminders" | "delete_reminder" | "help";

  switch (messageIntent) {
    case "reminder":
      await scheduleReminder({
        userData,
        message: body.body,
      });
      await reactMessage(userData.messageId, "✅");
      break;

    case "list_reminders":
      await listReminders({ userData });
      await reactMessage(userData.messageId, "📋");
      break;

    case "delete_reminder":
      await deleteReminder({ userData });
      await reactMessage(userData.messageId, "⚠");
      break;

    case "help":
    default:
      await sendMessage({
        phone: userData.phoneNumber,
        message: HELP_MESSAGE,
      });
      await reactMessage(userData.messageId, "ℹ️");
      break;
  }


  return c.json({
    success: true,
    message: "Message received",
    data: body,
  });
});

app.get("/", (c) => {
  console.log("Health check endpoint");
  return c.json({
    status: "ok",
    message: "Remind Me API is running",
  });
});

const port = Number(process.env.PORT) || 3000;

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server is running on http://localhost:${port}`);
