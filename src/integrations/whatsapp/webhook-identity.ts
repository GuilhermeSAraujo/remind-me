import type { MessagePayload } from "./types";

function isLidJid(jid: string | undefined): boolean {
    return Boolean(jid && jid.includes("@lid"));
}

function asPhoneJid(value: string): string {
    if (value.includes("@")) {
        return value;
    }
    const digits = value.replace(/\D/g, "");
    return digits ? `${digits}@s.whatsapp.net` : value;
}

export function resolveWebhookPhone(data: MessagePayload["data"]): string {
    const { key } = data;
    if (key.remoteJidAlt && !isLidJid(key.remoteJidAlt)) {
        return key.remoteJidAlt;
    }
    const senderPn = data.senderPn ?? key.senderPn;
    if (senderPn && !isLidJid(senderPn)) {
        return asPhoneJid(senderPn);
    }
    if (key.remoteJid && !isLidJid(key.remoteJid)) {
        return key.remoteJid;
    }
    return key.remoteJid;
}

export function inboundLidJid(data: MessagePayload["data"]): string | undefined {
    return isLidJid(data.key.remoteJid) ? data.key.remoteJid : undefined;
}

function hasInboundText(data: MessagePayload["data"]): boolean {
    const type = data.messageType;
    if (type === "conversation") {
        return Boolean(data.message?.conversation);
    }
    if (type === "extendedTextMessage") {
        return Boolean(data.message?.extendedTextMessage?.text);
    }
    if (type === "reactionMessage") {
        return Boolean(data.message?.reactionMessage);
    }
    return false;
}

export function isProcessableInbound(payload: MessagePayload): boolean {
    const data = payload.data;
    if (payload.event !== "messages.upsert" || !data?.key) {
        return false;
    }
    if (data.key.remoteJid?.includes("@g.us")) {
        return false;
    }
    if (data.key.fromMe) {
        return false;
    }
    return hasInboundText(data);
}

export function inboundMessageText(data: MessagePayload["data"]): string {
    return (
        data.message?.conversation ??
        data.message?.extendedTextMessage?.text ??
        ""
    ).trim();
}
