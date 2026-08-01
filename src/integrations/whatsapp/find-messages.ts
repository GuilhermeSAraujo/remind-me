import { env } from "../../config/env";
import { CONFIG } from "./client";

export interface FoundMessage {
    id: string;
    text: string;
    fromMe: boolean;
}

interface EvolutionMessageRecord {
    id?: string;
    key?: {
        id?: string;
        fromMe?: boolean;
        remoteJid?: string;
    };
    message?: {
        conversation?: string;
        extendedTextMessage?: { text?: string };
    };
    messageType?: string;
    fromMe?: boolean;
    messageTimestamp?: number | string;
}

interface FindMessagesResponse {
    messages?: {
        total?: number;
        records?: EvolutionMessageRecord[];
    };
}

function toRemoteJid(phone: string): string {
    if (phone.includes("@")) {
        return phone;
    }
    return `${phone}@s.whatsapp.net`;
}

function extractText(record: EvolutionMessageRecord): string {
    return (
        record.message?.conversation ??
        record.message?.extendedTextMessage?.text ??
        ""
    ).trim();
}

function toFoundMessage(record: EvolutionMessageRecord): FoundMessage | null {
    const id = record.key?.id ?? record.id;
    const text = extractText(record);
    if (!id || !text) {
        return null;
    }

    return {
        id,
        text,
        fromMe: record.fromMe ?? record.key?.fromMe ?? false,
    };
}

async function findMessages(
    where: Record<string, unknown>,
    options: { take?: number } = {},
): Promise<EvolutionMessageRecord[]> {
    try {
        const response = await fetch(
            `${CONFIG.API_BASE_URL}/chat/findMessages/${CONFIG.SESSION_NAME}`,
            {
                method: "POST",
                headers: {
                    accept: "application/json",
                    "Content-Type": "application/json",
                    apikey: env.AUTHENTICATION_API_KEY,
                },
                body: JSON.stringify({
                    where,
                    ...(options.take !== undefined ? { take: options.take } : {}),
                }),
            },
        );

        if (!response.ok) {
            const text = await response.text();
            console.error("[FIND MESSAGES] API ERROR:", response.status, text);
            return [];
        }

        const data = (await response.json()) as FindMessagesResponse;
        return data.messages?.records ?? [];
    } catch (error) {
        console.error("[FIND MESSAGES] Unexpected ERROR:", error);
        return [];
    }
}

function timestampOf(record: EvolutionMessageRecord): number {
    const ts = record.messageTimestamp;
    if (typeof ts === "number") {
        return ts;
    }
    if (typeof ts === "string") {
        const parsed = Number(ts);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

export async function findMessageById(
    phone: string,
    messageId: string,
): Promise<FoundMessage | null> {
    const records = await findMessages({
        key: {
            remoteJid: toRemoteJid(phone),
            id: messageId,
        },
    });

    const match =
        records.find((r) => r.key?.id === messageId || r.id === messageId) ??
        records[0];

    return match ? toFoundMessage(match) : null;
}

export async function findLastFromMeMessage(
    phone: string,
): Promise<FoundMessage | null> {
    const records = await findMessages(
        {
            key: {
                remoteJid: toRemoteJid(phone),
                fromMe: true,
            },
        },
        { take: 20 },
    );

    const fromMe = records.filter((r) => r.fromMe ?? r.key?.fromMe);
    if (fromMe.length === 0) {
        return null;
    }

    fromMe.sort((a, b) => timestampOf(b) - timestampOf(a));
    return toFoundMessage(fromMe[0]!);
}
