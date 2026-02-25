import { env } from "../../config/env";

export const CONFIG = {
    API_BASE_URL: env.WPPCONNECT_API_URL,
    SESSION_NAME: "remind-me-auto",
} as const;

let SESSION_TOKEN = "";

async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateSessionTokenWithRetry(
    maxAttempts = 5,
    delayMs = 30_000,
): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const tokenResponse = await fetch(
                `${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/${env.SECRET_KEY}/generate-token`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );

            if (!tokenResponse.ok) {
                throw new Error(
                    `Failed to generate session token: ${tokenResponse.status} ${tokenResponse.statusText}`,
                );
            }

            const tokenData = (await tokenResponse.json()) as { token: string };

            console.info(
                `[CONFIG] Session token generated (attempt ${attempt}/${maxAttempts})`,
            );

            return tokenData.token;
        } catch (error) {
            lastError = error;
            console.error(
                `[CONFIG] Error generating session token (attempt ${attempt}/${maxAttempts})`,
                error,
            );

            if (attempt < maxAttempts) {
                console.info(
                    `[CONFIG] Retrying session token generation in ${
                        delayMs / 1000
                    } seconds...`,
                );
                await delay(delayMs);
            }
        }
    }

    console.error(
        "[CONFIG] Unable to generate session token after multiple attempts. Shutting down application.",
        lastError,
    );

    // Gracefully stop the app so the orchestrator (e.g. Docker) can restart it
    process.exit(1);
}

export async function getSessionToken() {
    if (!SESSION_TOKEN) {
        await startSession();
    }

    return SESSION_TOKEN;
}

export async function startSession() {
    SESSION_TOKEN = await generateSessionTokenWithRetry();

    console.info("[CONFIG] Session initialized");

    const response = await fetch(
        `${CONFIG.API_BASE_URL}/api/${env.SECRET_KEY}/show-all-sessions`,
    );

    const existingSessions = (await response.json()) as { response: string[] };

    if (!existingSessions.response.includes(CONFIG.SESSION_NAME)) {
        console.info("[CONFIG] Creating new WhatsApp session");
        await fetch(
            `${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/start-session`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${SESSION_TOKEN}`,
                },
            },
        );

        return;
    }
}

