/**
 * Reminder message prefix utilities
 * Provides random prefixes for reminder messages and utilities to strip them
 */

const REMINDER_PREFIXES = [
    "⏰ Hora de: ",
    "⏲ Está na hora: ",
    "🔔 Lembrete: ",
    "⏰ Não esqueça: ",
    "🕐 Hora de fazer: ",
    "⏰ Chegou a hora de: ",
    "🔔 Ei, lembre-se: ",
    "⏲ É agora: ",
    "⏰ Atenção: ",
    "🔔 Momento de: "
];

export function getRandomPrefix(): string {
    const randomIndex = Math.floor(Math.random() * REMINDER_PREFIXES.length);
    return REMINDER_PREFIXES[randomIndex]!;
}

export function stripReminderPrefix(message: string): string {
    if (!message) {
        return "";
    }

    const trimmedMessage = message.trim();

    // Try to match and remove any of the known prefixes
    for (const prefix of REMINDER_PREFIXES) {
        if (trimmedMessage.startsWith(prefix)) {
            return trimmedMessage.substring(prefix.length).trim();
        }
    }

    // If no prefix found, return the original message
    return trimmedMessage;
}

