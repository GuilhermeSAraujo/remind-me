import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

process.loadEnvFile(".env");

export const env = createEnv({
    server: {
        SECRET_KEY: z.string().min(1),
        MONGODB_URI: z.url(),
        GOOGLE_API_KEY: z.string().min(1),
        EVOLUTION_API_URL: z.url().default("http://evolution-api:3333"),
        AUTHENTICATION_API_KEY: z.string().min(1),
        LOCAL_TEST_MODE: z
            .string()
            .optional()
            .default("false")
            .transform((val) => val === "true"),
        LOCAL_TEST_GROUP_ID: z.string().optional(),
        PORT: z.coerce.number().default(9002),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});
