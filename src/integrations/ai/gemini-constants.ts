export const PROMPT_CLASSIFY_MESSAGE_INTENT = (message: string) => `
You are a helpful assistant that can help with reminders via whatsapp chat.
You are given a message from a user and you need to classify the intent of their message.
The user message is: ${message}

Classify the message into one of these intents:
- "reminder": User wants to create a new reminder
- "list_reminders": User wants to see their existing reminders
- "delete_reminder": User wants to delete a reminder
- "delay_reminder": User wants to delay a reminder
- "help": User needs help or the message doesn't fit other categories

Respond with ONLY one of these exact words: reminder, list_reminders, delete_reminder, delay_reminder, or help

Examples:
"Me lembre de comprar pão às 14h" -> reminder
"Lembrete para tomar água amanhã" -> reminder
"Quais são meus lembretes?" -> list_reminders
"Lista meus lembretes" -> list_reminders
"Mostrar lembretes" -> list_reminders
"Ver meus lembretes" -> list_reminders
"Apagar lembrete" -> delete_reminder
"Deletar lembrete de comprar pão" -> delete_reminder
"Remover lembrete" -> delete_reminder
"Atrasar lembrete de comprar pão" -> delay_reminder
"Adiar lembrete de comprar pão" -> delay_reminder
"Adiar lembrete de comprar pão para amanhã" -> delay_reminder
"O que você faz?" -> help
"Ajuda" -> help
`;

export const PROMPT_EXTRACT_REMINDER_DATA = (message: string, currentDateTime: string) => `
You are given a message from a user and you need to EXTRACT the reminder data from the message.
The user message is: ${message}
Current date and time is: ${currentDateTime}

Extract the reminder data from the message.
Respond ONLY with a valid json object in PLAINTEXT format with the following structure:
{
    title string
    date string
    recurrence_type daily | weekly | monthly | yearly | none
    recurrence_interval number
}

Example: Me lembre de comprar pão 14h
{
    title: "Comprar pão",
    date: "2026-01-17 14:00:00",
    recurrence_type: "none",
    recurrence_interval: 0,
}

Example: Me lembre de comprar pão todos os dias as 14h
{
    title: "Comprar pão",
    date: "2026-01-17 14:00:00",
    recurrence_type: "daily",
    recurrence_interval: 1,
}
`;

export const PROMPT_IDENTIFY_DELAY = (message: string, currentScheduledTime: string, currentDateTime: string) => `
You are given a message from a user who wants to DELAY/POSTPONE a reminder.
The user message is: ${message}
Current date and time is: ${currentDateTime}
Current scheduled time of the reminder is: ${currentScheduledTime}

Extract the delay duration from the message and calculate the new scheduled time.
The user might specify the delay in minutes, hours, days, or use relative terms like "amanhã" (tomorrow), "próxima semana" (next week), etc.

Respond ONLY with a valid json object in PLAINTEXT format with the following structure:
{
    newScheduledTime string (format: "YYYY-MM-DD HH:mm:ss")
}

Examples:
User: "Adiar 30 minutos"
Current scheduled: "2026-01-20 14:00:00"
Current time: "2026-01-20 13:00:00"
Response:
{
    newScheduledTime: "2026-01-20 14:30:00"
}

User: "Daqui 2 dias"
Current scheduled: "2026-01-20 14:00:00"
Current time: "2026-01-20 13:00:00"
Response:
{
    newScheduledTime: "2026-01-22 14:00:00"
}

User: "amanhã"
Current scheduled: "2026-01-20 14:00:00"
Current time: "2026-01-20 13:00:00"
Response:
{
    newScheduledTime: "2026-01-21 14:00:00"
}

User: "próxima semana"
Current scheduled: "2026-01-20 14:00:00"
Current time: "2026-01-20 13:00:00"
Response:
{
    newScheduledTime: "2026-01-27 14:00:00"
}
`;

/**
 * List of smallest, most cost-effective Google AI models
 * Optimized for low token consumption and affordability
 * (Verified against actual available models via API - Jan 2026)
 * 
 * PRICING REFERENCE (per 1M tokens):
 * - Gemini 2.0 Flash-Lite: $0.075 input / $0.30 output (CHEAPEST!)
 * - Gemini 2.5 Flash-Lite: $0.10 input / $0.40 output
 * - Gemini 2.5 Flash: $0.30 input / $2.50 output
 * - Gemma models: Free tier with rate limits
 */
export const SMALL_CHEAP_MODELS = {
    /** 
     * ⭐ CHEAPEST PRODUCTION MODEL ⭐
     * Gemini 2.0 Flash-Lite - Most affordable paid model
     * Best for: High-volume requests, minimal cost
     * Limits: 1M input, 8K output
     * Cost: $0.075 input / $0.30 output per 1M tokens
     */
    GEMINI_2_0_FLASH_LITE: "gemini-2.0-flash-lite",

    /** 
     * Gemini 2.5 Flash-Lite - Newer generation, slightly more expensive
     * Best for: Balance of latest features and cost
     * Limits: 1M input, 65K output
     * Cost: $0.10 input / $0.40 output per 1M tokens (~33% more than 2.0)
     */
    GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite",

    /** 
     * Gemini Flash-Lite Latest - Auto-updates to latest lite version
     * Best for: Staying current with latest optimizations
     * Limits: 1M input, 65K output
     * Cost: Variable (follows latest lite model pricing)
     */
    GEMINI_FLASH_LITE_LATEST: "gemini-flash-lite-latest",

    /** 
     * Gemma 3n E2B - Ultra small model (2B parameters)
     * Best for: Free tier usage, simple classification
     * Limits: 8K input, 2K output, rate-limited
     * Cost: Free tier with limits
     */
    GEMMA_3N_E2B: "gemma-3n-e2b-it",

    /** 
     * Gemma 3n E4B - Ultra small model (4B parameters)
     * Best for: Free tier usage, basic tasks
     * Limits: 8K input, 2K output, rate-limited
     * Cost: Free tier with limits
     */
    GEMMA_3N_E4B: "gemma-3n-e4b-it",

    /** 
     * Gemma 3 1B - Small model (1B parameters)
     * Best for: Free tier, better quality than 3n variants
     * Limits: 32K input, 8K output, rate-limited
     * Cost: Free tier with limits
     */
    GEMMA_3_1B: "gemma-3-1b-it",
} as const;

/** 
 * Default model: Gemini 2.0 Flash-Lite (CHEAPEST paid option for high volume)
 * Perfect for tons of requests with minimal cost
 */
export const DEFAULT_AI_MODEL = SMALL_CHEAP_MODELS.GEMINI_2_5_FLASH_LITE;

