import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { existsSync } from "fs";

// Only load .env file if it exists (local development)
// In Docker, env vars are injected by docker-compose
if (existsSync(".env")) {
    process.loadEnvFile(".env");
}

export const env = createEnv({
    server: {
        SECRET_KEY: z.string().min(1),
        MONGODB_URI: z.url(),
        GOOGLE_API_KEY: z.string().min(1),
        WPPCONNECT_API_URL: z.url().default("http://localhost:21465"),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});

