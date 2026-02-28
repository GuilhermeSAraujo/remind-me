const BRAZIL_TZ = "America/Sao_Paulo";

export function parseBrazilDateString(dateStr: string): Date {
    return new Date(dateStr.replace(" ", "T"));
}

export function toBrazilDateTimeString(date: Date): string {
    return date.toLocaleString("sv-SE", { timeZone: BRAZIL_TZ });
}

export function getBrazilWeekday(): string {
    const weekdays = [
        "domingo",
        "segunda-feira",
        "terça-feira",
        "quarta-feira",
        "quinta-feira",
        "sexta-feira",
        "sábado",
    ];
    return weekdays[new Date().getDay()]!;
}

export function formatFriendlyDateTime(date: Date): string {
    const now = new Date();

    const dateFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: BRAZIL_TZ });
    const todayStr = dateFormatter.format(now);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = dateFormatter.format(tomorrow);

    const inputDateStr = dateFormatter.format(date);

    const timeString = date.toLocaleTimeString("pt-BR", {
        timeZone: BRAZIL_TZ,
        hour: "2-digit",
        minute: "2-digit",
    });

    if (inputDateStr === todayStr) {
        return `hoje às ${timeString}`;
    } else if (inputDateStr === tomorrowStr) {
        return `amanhã às ${timeString}`;
    }

    const dateString = date.toLocaleDateString("pt-BR", {
        timeZone: BRAZIL_TZ,
        day: "2-digit",
        month: "2-digit",
    });
    return `${dateString} - ${timeString}`;
}
