export function getBrazilTime(): string {
    // Get current time and convert to Brazil timezone (UTC-3)
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    return brazilTime.toISOString();
}

export function formatDateToBrazilianTimezone(date: Date): string {
    // Convert date to Brazil timezone (UTC-3) and format as "YYYY-MM-DD HH:mm:ss"
    const brazilTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
    return brazilTime.toISOString().slice(0, 19).replace('T', ' ');
}

