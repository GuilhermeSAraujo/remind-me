import { env } from "../../config/env";
import { CONFIG, getSessionToken } from "./client";

export async function getAllMessagesFromChat(phoneNumber: string) {
    try {
        const response = await fetch(
            `${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/all-messages-in-chat/${phoneNumber}${env.LOCAL_TEST_MODE ? `?isGroup=true` : ""}`,
            {
                method: "GET",
                headers: {
                    accept: "*/*",
                    Authorization: `Bearer ${await getSessionToken()}`,
                },
            },
        );

        if (!response.ok) {
            const text = await response.text();
            console.error("[GET ALL MESSAGES FROM CHAT] 🚨 API ERROR:", response.status, text);
            return null;
        }

        const data = (await response.json()) as {
            response: {
                id: string;
                fromMe: boolean;
                from: string;
                to: string;
                content: string;
                body: string;
            }[];
        };
        return data.response;
    } catch (error) {
        console.error("[GET ALL MESSAGES FROM CHAT] 🚨 Unexpected ERROR:", error);
        return null;
    }
}
