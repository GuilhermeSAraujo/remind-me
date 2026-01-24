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

export function getBrazilWeekday(): string {
    // Get current weekday in Brazil timezone
    const brazilDate = new Date(getBrazilTime());
    const weekdays = [
        'domingo',
        'segunda-feira',
        'terça-feira',
        'quarta-feira',
        'quinta-feira',
        'sexta-feira',
        'sábado'
    ];
    return weekdays[brazilDate.getDay()]!;
}

export function formatFriendlyDateTime(date: Date): string {
    const today = new Date(getBrazilTime());
    const tomorrow = new Date(getBrazilTime());
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Remove hours/minutes for date comparison
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    const timeString = date.toLocaleString("pt-BR", {
        hour: '2-digit',
        minute: '2-digit',
    });

    if (dateOnly.getTime() === today.getTime()) {
        return `hoje às ${timeString}`;
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
        return `amanhã às ${timeString}`;
    } else {
        const dateString = date.toLocaleDateString("pt-BR", {
            day: '2-digit',
            month: '2-digit',
        });
        return `${dateString} - ${timeString}`;
    }
}

