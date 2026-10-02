import { TypeSafeClient } from "@typesafe-ai/sdk";
import { env } from "../../config/env";

export const decisionClient = new TypeSafeClient({
    apiKey: env.TYPESAFE_API_KEY,
    defaultModel: "jev-latest",
});
