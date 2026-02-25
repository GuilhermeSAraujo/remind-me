import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

process.loadEnvFile(".env");

export const env = createEnv({
    server: {
        SECRET_KEY: z.string().min(1),
        MONGODB_URI: z.url(),
        GOOGLE_API_KEY: z.string().min(1),
        WPPCONNECT_API_URL: z.url().default("http://localhost:21465"),
        LOCAL_TEST_MODE: z
            .string()
            .optional()
            .default("false")
            .transform((val) => val === "true"),
        LOCAL_TEST_GROUP_ID: z.string().optional(),
        PORT: z.number().default(9002),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});
