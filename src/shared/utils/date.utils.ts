export function getBrazilTime(): string {
    // Get current time and convert to Brazil timezone (UTC-3)
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    return brazilTime.toISOString();
}

