import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { extractUserData, type UserData } from "./api/middlewares/user-extractor.middleware";
import type { MessagePayload } from "./integrations/whatsapp/types";
import { processMessage } from "./integrations/whatsapp/message-processor";
import { reactMessage } from "./integrations/whatsapp/react-message";
import { startSession } from "./integrations/whatsapp/client";
import "./config/database";
import "./jobs/scheduler";

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

    if (body.body?.startsWith("/")) {
        console.info("[SERVER] Command received:", body.body);
        return c.json({
            success: true,
            message: "Command received",
            data: body,
        });
    }

    await processMessage(body, userData);


    return c.json({
        success: true,
        message: "Message received",
        data: body,
    });
});

app.get("/", (c) => {
    return c.json({
        status: "ok",
        message: "Remind Me API is running",
    });
});

const port = Number(process.env.PORT) || 3030;

serve({
    fetch: app.fetch,
    port,
});

console.info(`[SERVER] Running on http://localhost:${port}`);

