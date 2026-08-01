const BRAZIL_TZ = "America/Sao_Paulo";

const WEEKDAYS_PT = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
] as const;

const EN_SHORT_TO_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

export type BrazilWeekdayName = (typeof WEEKDAYS_PT)[number];

export interface BrazilWeekdayDateEntry {
    esta: string;
    proxima: string;
}

export interface BrazilWeekdayDates {
    today: string;
    todayWeekday: BrazilWeekdayName;
    byWeekday: Record<BrazilWeekdayName, BrazilWeekdayDateEntry>;
}

export function parseBrazilDateString(dateStr: string): Date {
    return new Date(dateStr.replace(" ", "T"));
}

/** Floors a date to minute precision (seconds and ms → 0). */
export function truncateToMinute(date: Date): Date {
    const truncated = new Date(date);
    truncated.setUTCSeconds(0, 0);
    return truncated;
}

export function toBrazilDateTimeString(date: Date): string {
    return date.toLocaleString("sv-SE", { timeZone: BRAZIL_TZ });
}

/** Calendar date in America/Sao_Paulo as YYYY-MM-DD. */
export function toBrazilDateString(date: Date): string {
    return date.toLocaleDateString("en-CA", { timeZone: BRAZIL_TZ });
}

/** Weekday index 0=domingo … 6=sábado in America/Sao_Paulo (not server local). */
export function getBrazilWeekdayIndex(date: Date = new Date()): number {
    const short = new Intl.DateTimeFormat("en-US", {
        timeZone: BRAZIL_TZ,
        weekday: "short",
    }).format(date);
    const index = EN_SHORT_TO_INDEX[short];
    if (index === undefined) {
        throw new Error(`Unexpected weekday short name from Intl: ${short}`);
    }
    return index;
}

export function getBrazilWeekday(date: Date = new Date()): string {
    return WEEKDAYS_PT[getBrazilWeekdayIndex(date)]!;
}

/** Add calendar days to a YYYY-MM-DD string (timezone-agnostic date arithmetic). */
function addCalendarDays(yyyyMmDd: string, days: number): string {
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    const utc = new Date(Date.UTC(y!, m! - 1, d! + days, 12, 0, 0));
    return utc.toISOString().slice(0, 10);
}

/**
 * Computes esta/próxima calendar dates for every weekday in America/Sao_Paulo.
 * - esta: next occurrence including today
 * - próxima: next occurrence strictly after today when today is that weekday (+7)
 */
export function getBrazilWeekdayDates(now: Date = new Date()): BrazilWeekdayDates {
    const today = toBrazilDateString(now);
    const todayIndex = getBrazilWeekdayIndex(now);
    const todayWeekday = WEEKDAYS_PT[todayIndex]!;

    const byWeekday = {} as Record<BrazilWeekdayName, BrazilWeekdayDateEntry>;
    for (let target = 0; target < 7; target++) {
        const name = WEEKDAYS_PT[target]!;
        const daysUntilEsta = (target - todayIndex + 7) % 7;
        const daysUntilProxima = daysUntilEsta === 0 ? 7 : daysUntilEsta;
        byWeekday[name] = {
            esta: addCalendarDays(today, daysUntilEsta),
            proxima: addCalendarDays(today, daysUntilProxima),
        };
    }

    return { today, todayWeekday, byWeekday };
}

/** Prompt block: code-computed weekday → date lookup for the LLM to copy. */
export function buildBrazilWeekdayDateLookup(now: Date = new Date()): string {
    const { today, todayWeekday, byWeekday } = getBrazilWeekdayDates(now);
    const lines = WEEKDAYS_PT.map((name) => {
        const { esta, proxima } = byWeekday[name];
        if (esta === proxima) {
            return `- ${name}: esta/próxima=${esta}`;
        }
        return `- ${name}: esta=${esta}; próxima=${proxima}`;
    });

    return [
        "WEEKDAY DATE LOOKUP (America/Sao_Paulo) — copy these dates; do NOT recalculate:",
        `Today: ${today} (${todayWeekday})`,
        ...lines,
    ].join("\n");
}

/**
 * Dynamic weekday example built from the same lookup so dates always match "today".
 * Uses próxima quinta-feira (the bug class that motivated this change).
 */
export function buildBrazilWeekdayPromptExample(now: Date = new Date()): string {
    const { byWeekday } = getBrazilWeekdayDates(now);
    const date = byWeekday["quinta-feira"].proxima;
    return [
        "Example (using WEEKDAY DATE LOOKUP above): Me lembre próxima quinta-feira de buscar colchas 18h",
        `[`,
        `    {`,
        `        title: "Buscar colchas",`,
        `        date: "${date} 18:00:00",`,
        `        recurrence_type: "none",`,
        `        recurrence_interval: 0,`,
        `        recurrence_weekday: null,`,
        `        recurrence_nth: null,`,
        `        max_occurrences: null,`,
        `        end_date: null`,
        `    }`,
        `]`,
    ].join("\n");
}

/** Shorter dynamic example for the base (title+date only) extract prompt. */
export function buildBrazilWeekdayPromptExampleBase(now: Date = new Date()): string {
    const { byWeekday } = getBrazilWeekdayDates(now);
    const date = byWeekday["quinta-feira"].proxima;
    return [
        "Example (using WEEKDAY DATE LOOKUP above): Me lembre próxima quinta-feira de buscar colchas 18h",
        `[`,
        `    {`,
        `        "title": "Buscar colchas",`,
        `        "date": "${date} 18:00:00"`,
        `    }`,
        `]`,
    ].join("\n");
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
