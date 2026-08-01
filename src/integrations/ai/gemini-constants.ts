export const PROMPT_CLASSIFY_MESSAGE_INTENT = (message: string) => `
You are a helpful assistant that can help with reminders via whatsapp chat.
You are given a message from a user and you need to classify the intent of their message.
The user message is: ${message}

Classify the message into one of these intents:
- "reminder": User wants to create a new reminder
- "list_reminders": User wants to see their existing reminders
- "delete_reminder": User wants to delete a reminder
- "delay_reminder": User wants to delay a reminder
- "buy_premium": User wants to buy, subscribe, or upgrade to the premium plan
- "help": User needs help or the message doesn't fit other categories

Respond with ONLY one of these exact words: reminder, list_reminders, delete_reminder, delay_reminder, buy_premium, or help

Examples:
"Me lembre de comprar pão às 14h" -> reminder
"Lembrete para tomar água amanhã" -> reminder
"Ligar para o Pedro amanhã às 10h" -> reminder
"Cobrar a Maria amanhã às 09:00" -> reminder
"Quais são meus lembretes?" -> list_reminders
"Lista meus lembretes" -> list_reminders
"Mostrar lembretes" -> list_reminders
"Ver meus lembretes" -> list_reminders
"Apagar lembrete" -> delete_reminder
"Deletar lembrete de comprar pão" -> delete_reminder
"Remover lembrete" -> delete_reminder
"Adiar 30 minutos" -> delay_reminder
"Atrasar 2 horas" -> delay_reminder
"delay de 15 minutos" -> delay_reminder
"Adiar 1 dia" -> delay_reminder
"1" -> help
"30" -> help
"amanhã" -> help
"Adiar" -> help
"Quero assinar o premium" -> buy_premium
"Quanto custa o plano pago?" -> buy_premium
"Quero comprar o premium" -> buy_premium
"Quero começar a usar" -> help
"O que você faz?" -> help
"Ajuda" -> help
`;

export const PROMPT_EXTRACT_REMINDER_DATA = (
    message: string,
    currentDateTime: string,
    weekday: string,
) => `
You are given a message from a user and you need to EXTRACT the reminder data from the message.
The user message is: ${message}
Current date and time is: ${currentDateTime}. The weekday is ${weekday}.

Extract ALL reminders from the message. If there's only one reminder, return an array with one element.
Respond ONLY with a valid JSON ARRAY in PLAINTEXT format with the following structure:
[
    {
        title string
        date string
        recurrence_type hourly | daily | weekly | monthly | yearly | weekday | weekend | monthly_nth_weekday | monthly_last_business_day | monthly_first_business_day | none
        recurrence_interval number
        recurrence_weekday number | null   (0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado — only for monthly_nth_weekday, null otherwise)
        recurrence_nth number | null       (1–5 or -1 for "último/a" — only for monthly_nth_weekday, null otherwise)
        max_occurrences number | null   (null if no limit on number of times)
        end_date string | null          (format: "YYYY-MM-DD HH:mm:ss", null if no end date)
    }
]

IMPORTANT RULES FOR CALCULATING THE FIRST OCCURRENCE:

For recurrence_type "weekday" (Monday-Friday):
- Schedule for the NEXT weekday from now
- If today is weekend (Saturday/Sunday), schedule for next Monday

For recurrence_type "weekend" (Saturday/Sunday):
- Schedule for the NEXT weekend day from now
- If today is a weekday, schedule for next Saturday

For all other recurrence types (hourly, daily, weekly, monthly, yearly):
- Schedule for the first occurrence that makes sense based on the message
- If the time has already passed today, schedule for the next appropriate occurrence

For recurrence_type "monthly_nth_weekday":
- Use when the user specifies a specific weekday + "de cada mês" / "todo mês"
- Examples: "primeira terça-feira de cada mês", "última sexta do mês", "terceira quarta-feira"
- For "date": compute the next upcoming occurrence of that rule from the current date

For recurrence_type "monthly_last_business_day":
- Use when the user says "último dia útil do mês" or similar
- For "date": compute the last Monday–Friday of the current month (if it hasn't passed) or next month

For recurrence_type "monthly_first_business_day":
- Use when the user says "primeiro dia útil do mês" or similar
- For "date": compute the first Monday–Friday of the current month (if it hasn't passed) or next month

For max_occurrences:
- Set when the user specifies a finite number of repetitions (e.g. "5 vezes", "3x", "10 vezes")
- Otherwise set to null

For end_date:
- Set when the user specifies a duration or end date (e.g. "durante 5 dias", "até sexta-feira", "por 2 semanas")
- Calculate end_date by adding the duration to the first occurrence date
- Otherwise set to null. (Exception: see HOURLY SCOPE RULE below.)

HOURLY SCOPE RULE (overrides the end_date rule above for recurrence_type "hourly"):
- No multi-day scope marker ("todo dia", "diariamente", "toda semana", "durante X dias", "por X dias"): set end_date to [first occurrence date] 23:59:59 (use the date portion from the computed first occurrence).
- Explicit duration ("durante 5 dias"): compute end_date = first occurrence + duration (existing behaviour).
- Eternal marker present ("todo dia", "diariamente"): leave end_date null.

Example: Me lembre de comprar pão 14h
[
    {
        title: "Comprar pão",
        date: "2026-01-17 14:00:00",
        recurrence_type: "none",
        recurrence_interval: 0,
        max_occurrences: null,
        end_date: null
    }
]

Example: Me lembre de comprar pão todos os dias as 14h
[
    {
        title: "Comprar pão",
        date: "2026-01-17 14:00:00",
        recurrence_type: "daily",
        recurrence_interval: 1,
        max_occurrences: null,
        end_date: null
    }
]

Example: Me lembre de lavar louça toda terça-feira 14h e de ir ao mercado toda quarta-feira 19h
[
    {
        title: "Lavar louça",
        date: "2026-01-21 14:00:00",
        recurrence_type: "weekly",
        recurrence_interval: 1,
        max_occurrences: null,
        end_date: null
    },
    {
        title: "Ir ao mercado",
        date: "2026-01-22 19:00:00",
        recurrence_type: "weekly",
        recurrence_interval: 1,
        max_occurrences: null,
        end_date: null
    }
]

Example: Me lembre de fazer exercício nos dias de semana às 7h
[
    {
        title: "Fazer exercício",
        date: "2026-01-26 07:00:00",
        recurrence_type: "weekday",
        recurrence_interval: 1,
        max_occurrences: null,
        end_date: null
    }
]

Example: Me lembre de descansar aos finais de semana às 10h
[
    {
        title: "Descansar",
        date: "2026-01-25 10:00:00",
        recurrence_type: "weekend",
        recurrence_interval: 1,
        max_occurrences: null,
        end_date: null
    }
]

Example: Me lembre durante os dias úteis às 13h de trabalhar
[
    {
        title: "Trabalhar",
        date: "2026-01-26 13:00:00",
        recurrence_type: "weekday",
        recurrence_interval: 1,
        max_occurrences: null,
        end_date: null
    }
]

Example: Me lembre de tomar remédio a cada 8h durante 5 dias
[
    {
        title: "Tomar remédio",
        date: "2026-03-11 08:00:00",
        recurrence_type: "hourly",
        recurrence_interval: 8,
        max_occurrences: null,
        end_date: "2026-03-16 08:00:00"
    }
]

Example: Me lembre de olhar o celular 5x a cada 15 minutos
[
    {
        title: "Olhar o celular",
        date: "2026-03-11 08:00:00",
        recurrence_type: "hourly",
        recurrence_interval: 0.25,
        recurrence_weekday: null,
        recurrence_nth: null,
        max_occurrences: 5,
        end_date: null
    }
]

Example: Me lembrar de tomar o remédio de quatro em quatro horas (current date 2026-03-15)
[
    {
        title: "Tomar remédio",
        date: "2026-03-15 08:00:00",
        recurrence_type: "hourly",
        recurrence_interval: 4,
        recurrence_weekday: null,
        recurrence_nth: null,
        max_occurrences: null,
        end_date: "2026-03-15 23:59:59"
    }
]

Example: Tomar remédio de 4 em 4 horas durante 3 dias (current date 2026-03-15)
[
    {
        title: "Tomar remédio",
        date: "2026-03-15 08:00:00",
        recurrence_type: "hourly",
        recurrence_interval: 4,
        recurrence_weekday: null,
        recurrence_nth: null,
        max_occurrences: null,
        end_date: "2026-03-18 08:00:00"
    }
]

Example: Tomar remédio de hora em hora todo dia (current date 2026-03-15)
[
    {
        title: "Tomar remédio",
        date: "2026-03-15 08:00:00",
        recurrence_type: "hourly",
        recurrence_interval: 1,
        recurrence_weekday: null,
        recurrence_nth: null,
        max_occurrences: null,
        end_date: null
    }
]

Example: Me lembre todo último dia útil do mês às 10h
[
    {
        title: "Lembrete mensal",
        date: "2026-03-31 10:00:00",
        recurrence_type: "monthly_last_business_day",
        recurrence_interval: 1,
        recurrence_weekday: null,
        recurrence_nth: null,
        max_occurrences: null,
        end_date: null
    }
]

Example: Me lembre toda primeira terça-feira de cada mês às 9h
[
    {
        title: "Lembrete mensal",
        date: "2026-04-07 09:00:00",
        recurrence_type: "monthly_nth_weekday",
        recurrence_interval: 1,
        recurrence_weekday: 2,
        recurrence_nth: 1,
        max_occurrences: null,
        end_date: null
    }
]
`;

export const PROMPT_EXTRACT_REMINDER_BASE = (
    message: string,
    currentDateTime: string,
    weekday: string,
) => `
You are given a message from a user and you need to extract reminders from it.
The user message is: ${message}
Current date and time is: ${currentDateTime}. The weekday is ${weekday}.

Extract ALL reminders from the message. If there's only one reminder, return an array with one element.
Respond ONLY with a valid JSON ARRAY in PLAINTEXT format with the following structure:
[
    {
        "title": string,
        "date": string   (format: "YYYY-MM-DD HH:mm:ss")
    }
]

Do NOT include any recurrence, frequency, or repetition information. Extract only title and date.

For messages that describe the SAME reminder happening multiple times (for example: "de 4 em 4 horas",
"às 8h, 12h, 16h e 20h", "várias vezes hoje"):
- Create ONLY ONE reminder object in the array for that reminder.
- Use the FIRST occurrence that makes sense as the "date" value.
- Only create multiple objects when the message clearly describes DIFFERENT reminder tasks (different actions/titles).

RULES FOR date:
- Schedule for the first occurrence that makes sense based on the message.
- If the time has already passed today, schedule for the next appropriate occurrence.
- If no time is specified, use a sensible default (e.g. 08:00:00).
- For calendar-rule recurrences (último dia útil, primeira terça-feira etc.): compute the next upcoming concrete occurrence from the current date.

Example: Me lembre de comprar pão às 14h
[
    {
        "title": "Comprar pão",
        "date": "2026-01-17 14:00:00"
    }
]

Example: Me lembre de lavar louça toda terça-feira 14h e de ir ao mercado toda quarta-feira 19h
[
    {
        "title": "Lavar louça",
        "date": "2026-01-21 14:00:00"
    },
    {
        "title": "Ir ao mercado",
        "date": "2026-01-22 19:00:00"
    }
]

Example: Me lembre de tomar remédio hoje de 4 em 4 horas, partindo de agora
[
    {
        "title": "Tomar remédio",
        "date": "2026-01-17 13:39:00"
    }
]

Example: Me lembre de tomar remédio hoje às 8h, 12h, 16h e 20h
[
    {
        "title": "Tomar remédio",
        "date": "2026-01-17 08:00:00"
    }
]
`;

export const PROMPT_EXTRACT_RECURRENCE = (
    originalMessage: string,
    title: string,
    date: string,
) => `
You already identified a reminder: title "${title}", scheduled for ${date}.
The original user message was: ${originalMessage}

Now extract ONLY the recurrence information for this reminder.
Respond ONLY with a valid JSON OBJECT in PLAINTEXT format:
{
    "recurrence_type": "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "weekday" | "weekend" | "monthly_nth_weekday" | "monthly_last_business_day" | "monthly_first_business_day" | "none",
    "recurrence_interval": number,
    "recurrence_weekday": number | null,
    "recurrence_nth": number | null,
    "max_occurrences": number | null,
    "end_date": string | null   (format: "YYYY-MM-DD HH:mm:ss")
}

CRITICAL RULES:
- Default to "none" with interval 0. Only set a recurrence type if the message CLEARLY and EXPLICITLY states repetition.
- Words like "todo dia", "toda semana", "diariamente", "semanalmente", "toda terça", etc. indicate recurrence.
- A single future date ("amanhã", "na sexta", "às 14h") is NOT recurrence — use "none".
- max_occurrences: set only if the user specifies a finite count (e.g. "5 vezes", "3x"). Otherwise null.
- end_date: set only if the user specifies a duration or end date (e.g. "durante 5 dias", "até sexta"). Otherwise null. (Exception: see HOURLY SCOPE RULE below.)
- HOURLY SCOPE RULE (overrides the end_date rule above for recurrence_type "hourly") —
  • No multi-day scope marker ("todo dia", "diariamente", "toda semana", "durante X dias", "por X dias"): set end_date to [first occurrence date] 23:59:59 (use the date portion from the scheduled date shown above).
  • Explicit duration ("durante 5 dias"): compute end_date = first occurrence + duration.
  • Eternal marker present ("todo dia", "diariamente"): leave end_date null.

- Calendar rules (monthly_nth_weekday, monthly_last_business_day, monthly_first_business_day): fill recurrence_weekday and recurrence_nth as the user specifies; end_date null unless stated.

RECURRENCE_FALLBACK (use when no recurrence):
{"recurrence_type":"none","recurrence_interval":0,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":null}

Example: Me lembre de comprar pão às 14h  →  title "Comprar pão"
{"recurrence_type":"none","recurrence_interval":0,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":null}

Example: Me lembre de fazer exercício todos os dias às 7h  →  title "Fazer exercício"
{"recurrence_type":"daily","recurrence_interval":1,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":null}

Example: Me lembre de lavar louça toda terça-feira às 14h  →  title "Lavar louça"
{"recurrence_type":"weekly","recurrence_interval":1,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":null}

Example: Me lembre de tomar remédio a cada 8h durante 5 dias  →  title "Tomar remédio"
{"recurrence_type":"hourly","recurrence_interval":8,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":"2026-03-16 08:00:00"}

Example: Me lembre todo último dia útil do mês às 10h  →  title "Lembrete mensal"
{"recurrence_type":"monthly_last_business_day","recurrence_interval":1,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":null}

Example: Me lembre toda primeira terça-feira de cada mês às 9h  →  title "Lembrete mensal"
{"recurrence_type":"monthly_nth_weekday","recurrence_interval":1,"recurrence_weekday":2,"recurrence_nth":1,"max_occurrences":null,"end_date":null}

NOTE: Sub-hour intervals (e.g. "a cada 15 minutos") are not supported by the current recurrence engine.
The engine uses JavaScript's setHours(getHours() + interval), which truncates floats — so 0.25 would
add 0 hours. Until the engine is updated to support minute-level precision, always use the nearest
whole number of hours (minimum 1) for hourly recurrence_interval.

Example: Me lembre de olhar o celular 5x a cada 15 minutos  →  title "Olhar o celular"
{"recurrence_type":"hourly","recurrence_interval":1,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":5,"end_date":null}

Example: Me lembrar de tomar o remédio de quatro em quatro horas  →  title "Tomar remédio"
{"recurrence_type":"hourly","recurrence_interval":4,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":"${date.split(" ")[0]} 23:59:59"}

Example: Tomar remédio de 4 em 4 horas durante 3 dias  →  title "Tomar remédio"
{"recurrence_type":"hourly","recurrence_interval":4,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":"2026-03-18 08:00:00"}

Example: Tomar remédio de hora em hora todo dia  →  title "Tomar remédio"
{"recurrence_type":"hourly","recurrence_interval":1,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":null}
`;

export const PROMPT_IDENTIFY_DELAY = (message: string, currentDateTime: string) => `
  Task: compute a new reminder time by applying a delay from NOW.

  Message: "${message}"
  Current date time (America/Sao_Paulo): ${currentDateTime}

  Rules:
  - The message expresses a delay with an amount and unit (minutes, hours, days).
  - Calculate the new time based on the CURRENT date time above (not any previous reminder time).
  - Add the requested delay to the current date time.
  - Use format: YYYY-MM-DD HH:mm:ss

  Output ONLY this JSON (no extra text):
  {"newScheduledTime":"YYYY-MM-DD HH:mm:ss"}

  Example: Adiar 30 minutos
  Current date time: 2026-01-20 14:00:00
  Output: {"newScheduledTime":"2026-01-20 14:30:00"}

  Example: Adiar 2 horas
  Current date time: 2026-01-20 14:00:00
  Output: {"newScheduledTime":"2026-01-20 16:00:00"}

  Example: Adiar 2 dias
  Current date time: 2026-01-20 14:00:00
  Output: {"newScheduledTime":"2026-01-22 14:00:00"}
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
