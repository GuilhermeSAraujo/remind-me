import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessagePayload } from "../../integrations/whatsapp/types";
import { isProcessableInbound, resolveWebhookPhone } from "../../integrations/whatsapp/webhook-identity";

const { mockFindOrCreateUser } = vi.hoisted(() => ({
    mockFindOrCreateUser: vi.fn(),
}));

vi.mock("../../domain/users/user.service", () => ({
    UserService: class {
        findOrCreateUser = mockFindOrCreateUser;
    },
}));

vi.spyOn(console, "info").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

import { Hono } from "hono";
import { extractUserData } from "./user-extractor.middleware";

function basePayload(overrides: Partial<MessagePayload["data"]> = {}): MessagePayload {
    return {
        event: "messages.upsert",
        data: {
            key: {
                remoteJid: "553198296801@s.whatsapp.net",
                fromMe: false,
                id: "wamid.1",
            },
            pushName: "Victor",
            status: "DELIVERY_ACK",
            message: { conversation: "sim" },
            messageType: "conversation",
            ...overrides,
        },
    };
}

describe("resolveWebhookPhone", () => {
    it("prefers remoteJidAlt when it is a phone JID", () => {
        const payload = basePayload({
            key: {
                remoteJid: "140393070978714@lid",
                remoteJidAlt: "553198296801@s.whatsapp.net",
                fromMe: false,
                id: "wamid.1",
            },
        });
        expect(resolveWebhookPhone(payload.data)).toBe("553198296801@s.whatsapp.net");
    });

    it("uses senderPn when remoteJid is a LID", () => {
        const payload = basePayload({
            key: {
                remoteJid: "140393070978714@lid",
                fromMe: false,
                id: "wamid.1",
            },
            senderPn: "553198296801",
        });
        expect(resolveWebhookPhone(payload.data)).toBe("553198296801@s.whatsapp.net");
    });

    it("falls back to remoteJid when it is already a phone JID", () => {
        expect(resolveWebhookPhone(basePayload().data)).toBe("553198296801@s.whatsapp.net");
    });
});

describe("isProcessableInbound", () => {
    it("accepts extendedTextMessage", () => {
        expect(
            isProcessableInbound(
                basePayload({
                    message: { extendedTextMessage: { text: "sim" } },
                    messageType: "extendedTextMessage",
                }),
            ),
        ).toBe(true);
    });

    it("rejects bot echoes", () => {
        expect(
            isProcessableInbound(
                basePayload({
                    key: {
                        remoteJid: "553198296801@s.whatsapp.net",
                        fromMe: true,
                        id: "wamid.1",
                    },
                }),
            ),
        ).toBe(false);
    });
});

describe("extractUserData", () => {
    const app = new Hono();
    app.post("/", extractUserData, (c) => {
        return c.json({ userData: c.get("userData") });
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockFindOrCreateUser.mockResolvedValue({
            phoneNumber: "553198296801@s.whatsapp.net",
            name: "Victor",
        });
    });

    it("finds or creates the user with the resolved phone, not the LID", async () => {
        const payload = basePayload({
            key: {
                remoteJid: "140393070978714@lid",
                remoteJidAlt: "553198296801@s.whatsapp.net",
                fromMe: false,
                id: "wamid.1",
            },
        });

        const res = await app.request("/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        expect(res.status).toBe(200);
        expect(mockFindOrCreateUser).toHaveBeenCalledWith(
            "553198296801@s.whatsapp.net",
            "Victor",
            "140393070978714@lid",
        );
    });

    it("skips fromMe messages", async () => {
        const payload = basePayload({
            key: {
                remoteJid: "553198296801@s.whatsapp.net",
                fromMe: true,
                id: "wamid.1",
            },
        });

        const res = await app.request("/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        expect(res.status).toBe(204);
        expect(mockFindOrCreateUser).not.toHaveBeenCalled();
    });

    it("accepts extendedTextMessage replies", async () => {
        const payload = basePayload({
            message: { extendedTextMessage: { text: "sim" } },
            messageType: "extendedTextMessage",
        });

        const res = await app.request("/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        expect(res.status).toBe(200);
        expect(mockFindOrCreateUser).toHaveBeenCalled();
    });
});
