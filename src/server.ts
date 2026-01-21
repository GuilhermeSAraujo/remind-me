import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
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

// Configuração do Swagger
app.get("/swagger", swaggerUI({ url: "/api-doc" }));

app.get("/api-doc", (c) => {
    return c.json({
        openapi: "3.0.0",
        info: {
            version: "0.0.1-beta",
            title: "Remind Me API",
            description: "API do bot de agendamento de tarefas e lembretes via WhatsApp",
        },
        servers: [
            {
                url: "http://localhost:3030",
                description: "Servidor local",
            },
        ],
        paths: {
            "/message": {
                post: {
                    summary: "Recebe mensagens do WhatsApp",
                    description: "Endpoint para processar mensagens recebidas do WhatsApp",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["event", "id", "sender", "body", "from"],
                                    properties: {
                                        event: {
                                            type: "string",
                                            enum: ["onmessage", "qrcode", "qrReadSuccess"],
                                            description: "Tipo do evento",
                                        },
                                        id: {
                                            type: "string",
                                            description: "ID da mensagem",
                                        },
                                        sender: {
                                            type: "object",
                                            properties: {
                                                id: {
                                                    type: "string",
                                                    description: "ID do remetente",
                                                },
                                                name: {
                                                    type: "string",
                                                    description: "Nome do contato (opcional se não salvo)",
                                                },
                                            },
                                            required: ["id"],
                                        },
                                        body: {
                                            type: "string",
                                            description: "Conteúdo da mensagem",
                                        },
                                        from: {
                                            type: "string",
                                            description: "Número do remetente (formato: 5511999999999@c.us)",
                                        },
                                        urlcode: {
                                            type: "string",
                                            description: "URL do QR Code (apenas para event qrcode)",
                                        },
                                        quotedMsgId: {
                                            type: "string",
                                            description: "ID da mensagem citada",
                                        },
                                        notifyName: {
                                            type: "string",
                                            description: "Nome do perfil do WhatsApp",
                                        },
                                        pushname: {
                                            type: "string",
                                            description: "Push name alternativo",
                                        },
                                    },
                                },
                                examples: {
                                    mensagemNormal: {
                                        summary: "Mensagem normal de um contato salvo",
                                        value: {
                                            event: "onmessage",
                                            id: "true_5511999999999@c.us_3EB0123456789ABCDEF",
                                            sender: {
                                                id: "5511999999999@c.us",
                                                name: "João Silva",
                                            },
                                            body: "Me lembre de tomar remédio amanhã às 10h",
                                            from: "5511999999999@c.us",
                                        },
                                    },
                                    contatoNaoSalvo: {
                                        summary: "Mensagem de contato não salvo",
                                        value: {
                                            event: "onmessage",
                                            id: "true_5511888888888@c.us_3EB0987654321FEDCBA",
                                            sender: {
                                                id: "5511888888888@c.us",
                                            },
                                            body: "Agendar reunião para sexta-feira às 14h",
                                            from: "5511888888888@c.us",
                                            notifyName: "Maria Santos",
                                            pushname: "Maria",
                                        },
                                    },
                                    comando: {
                                        summary: "Comando começando com /",
                                        value: {
                                            event: "onmessage",
                                            id: "true_5511777777777@c.us_3EB0AABBCCDDEE1122",
                                            sender: {
                                                id: "5511777777777@c.us",
                                                name: "Carlos Pereira",
                                            },
                                            body: "/listar",
                                            from: "5511777777777@c.us",
                                        },
                                    },
                                    mensagemCitada: {
                                        summary: "Mensagem com citação",
                                        value: {
                                            event: "onmessage",
                                            id: "true_5511666666666@c.us_3EB0112233445566",
                                            sender: {
                                                id: "5511666666666@c.us",
                                                name: "Ana Costa",
                                            },
                                            body: "Obrigado!",
                                            from: "5511666666666@c.us",
                                            quotedMsgId: "true_5511666666666@c.us_3EB0998877665544",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Mensagem processada com sucesso",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: {
                                                type: "boolean",
                                            },
                                            message: {
                                                type: "string",
                                            },
                                            data: {
                                                type: "object",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        "204": {
                            description: "Evento não processável",
                        },
                        "400": {
                            description: "Payload JSON inválido",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: {
                                                type: "boolean",
                                            },
                                            message: {
                                                type: "string",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            "/": {
                get: {
                    summary: "Health check",
                    description: "Verifica se a API está funcionando",
                    responses: {
                        "200": {
                            description: "API está funcionando",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: {
                                                type: "string",
                                            },
                                            message: {
                                                type: "string",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
});

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
console.info(`[SERVER] Swagger UI available at http://localhost:${port}/swagger`);

