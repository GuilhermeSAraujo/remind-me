process.env.TZ = "America/Sao_Paulo";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { extractUserData, type UserData } from "./api/middlewares/user-extractor.middleware";
import "./config/database";
import { env } from "./config/env";
// import { startSession } from "./integrations/whatsapp/client";
import { processMessage } from "./integrations/whatsapp/message-processor";
// import { reactMessage } from "./integrations/whatsapp/react-message";
// import { startTyping } from "./integrations/whatsapp/start-typing";
import type { MessagePayload } from "./integrations/whatsapp/types";
import "./jobs/premium-payment.watcher";
import "./jobs/scheduler";

type Variables = {
    messageBody: MessagePayload;
    userData?: UserData;
};

// await startSession();

const app = new Hono<{ Variables: Variables }>();

app.post("", extractUserData, async (c) => {
    const body = c.get("messageBody");

    const userData = c.get("userData");

    if (body?.event !== "messages.upsert" || !userData) {
        return c.json({}, 200);
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

const port = env.PORT;

serve({
    fetch: app.fetch,
    port,
});

console.info(`[SERVER] Running on http://localhost:${port}`);
