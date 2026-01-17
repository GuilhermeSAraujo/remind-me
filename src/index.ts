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
import { scheduleReminder } from "./reminder";
import { startSession } from "./whatsApp/config";
import "./db";
import "./crons";

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

  const messageIntent = await generateContent(`
      You are a helpful assistant that can help with reminders via whatsapp chat.
      You are given a message from a user and you need to respond to them based on the message.
      The user message is: ${body.body}

      Classify if this message is requiring a reminder to be created.

      Respond with a plain text message containing only true or false.

      Example: "Me lembre de comprar pão" -> true
      Example: "O que é o que você faz?" -> false
    `);

  const shouldScheduleReminder = messageIntent === "true";

  if (shouldScheduleReminder) {
    await scheduleReminder({
      userData,
      message: body.body,
    });
    await reactMessage(userData.messageId, "✅");
  } else {
    await sendMessage({
      phone: userData.phoneNumber,
      message: `Olá! Sou o bot de lembretes. 📝

Para criar um lembrete, envie uma mensagem como:

• "Me lembre de comprar pão às 14h"
• "Lembrete para tomar água todos os dias às 9h"
• "Lembrar de pagar conta toda semana às 10h"
• "Me lembre de fazer backup todo mês às 15h"

Exemplos de recorrência:
✓ Sem repetição: "às 14h", "amanhã às 10h"
✓ Diário: "todos os dias", "diariamente"
✓ Semanal: "toda semana", "semanalmente"
✓ Mensal: "todo mês", "mensalmente"
✓ Anual: "todo ano", "anualmente"
`,
    });
    await reactMessage(userData.messageId, "ℹ️");
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
