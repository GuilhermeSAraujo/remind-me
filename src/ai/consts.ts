export const PROMPT_CLASSIFY_MESSAGE_INTENT = (message: string) => `
You are a helpful assistant that can help with reminders via whatsapp chat.
You are given a message from a user and you need to respond to them based on the message.
The user message is: ${message}

Classify if this message is requiring a reminder to be created.

Respond with a plain text message containing only true or false.

Example: "Me lembre de comprar pão" -> true
Example: "O que é o que você faz?" -> false
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

