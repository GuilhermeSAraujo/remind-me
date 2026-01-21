import { CONFIG, getSessionToken } from "./client";


export async function getMessageById(messageId: string): Promise<string | null> {
    try {
        const response = await fetch(
            `${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/message-by-id/${encodeURIComponent(messageId)}`,
            {
                method: "GET",
                headers: {
                    accept: "*/*",
                    Authorization: `Bearer ${await getSessionToken()}`,
                },
            }
        );

        if (!response.ok) {
            const text = await response.text();
            console.error("[GET MESSAGE BY ID] 🚨 API ERROR:", response.status, text);
            return null;
        }

        const data = await response.json() as { response: { message: string } };
        return data.response?.message;
    } catch (error) {
        console.error("[GET MESSAGE BY ID] 🚨 Unexpected ERROR:", error);
        return null;
    }
}

