export const PROMPT_CLASSIFY_MESSAGE_INTENT = (message: string) => `
You are a helpful assistant that can help with reminders via whatsapp chat.
You are given a message from a user and you need to classify the intent of their message.
The user message is: ${message}

Classify the message into one of these intents:
- "reminder": User wants to create a new reminder
- "list_reminders": User wants to see their existing reminders
- "delete_reminder": User wants to delete a reminder
- "help": User needs help or the message doesn't fit other categories

Respond with ONLY one of these exact words: reminder, list_reminders, delete_reminder, or help

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
"O que você faz?" -> help
"Ajuda" -> help
`;

export const PROMPT_EXTRACT_REMINDER_DATA = (message: string, currentDateTime: string) => `
You are a helpful assistant that can help with reminders via whatsapp chat.
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

