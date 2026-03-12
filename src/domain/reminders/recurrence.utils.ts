// --- Easter algorithm (Anonymous Gregorian) ---
function computeEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

export function getBrazilianHolidays(year: number): Date[] {
    const fixed = [
        new Date(year, 0, 1),   // Ano Novo
        new Date(year, 3, 21),  // Tiradentes
        new Date(year, 4, 1),   // Dia do Trabalho
        new Date(year, 8, 7),   // Independ?ncia
        new Date(year, 9, 12),  // Nossa Senhora Aparecida
        new Date(year, 10, 2),  // Finados
        new Date(year, 10, 15), // Proclama??o da Rep?blica
        new Date(year, 10, 20), // Consci?ncia Negra
        new Date(year, 11, 25), // Natal
    ];
    const easter = computeEaster(year);
    const moveable = [
        addDays(easter, -48), // Carnaval segunda
        addDays(easter, -47), // Carnaval ter?a
        addDays(easter, -2),  // Sexta-feira Santa
        addDays(easter, 60),  // Corpus Christi
    ];
    return [...fixed, ...moveable];
}

function isHoliday(date: Date, holidays: Date[]): boolean {
    return holidays.some(h => isSameDay(h, date));
}

function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}

export function getNthWeekdayOfMonth(
    year: number,
    month: number,
    weekday: number,
    nth: number,
    time: Date,
): Date {
    const result = new Date(year, month, 1, time.getHours(), time.getMinutes(), 0, 0);

    if (nth === -1) {
        result.setMonth(result.getMonth() + 1, 0); // last day of month
        while (result.getDay() !== weekday) {
            result.setDate(result.getDate() - 1);
        }
    } else {
        while (result.getDay() !== weekday) {
            result.setDate(result.getDate() + 1);
        }
        result.setDate(result.getDate() + (nth - 1) * 7);
    }

    return result;
}

export function getFirstBusinessDayOfMonth(
    year: number,
    month: number,
    time: Date,
    holidays: Date[] = [],
): Date {
    const result = new Date(year, month, 1, time.getHours(), time.getMinutes(), 0, 0);
    while (isWeekend(result) || isHoliday(result, holidays)) {
        result.setDate(result.getDate() + 1);
    }
    return result;
}

export function getLastBusinessDayOfMonth(
    year: number,
    month: number,
    time: Date,
    holidays: Date[] = [],
): Date {
    const result = new Date(year, month + 1, 0, time.getHours(), time.getMinutes(), 0, 0);
    while (isWeekend(result) || isHoliday(result, holidays)) {
        result.setDate(result.getDate() - 1);
    }
    return result;
}

export function calculateNextScheduledTime(
    currentTime: Date,
    recurrenceType:
        | "hourly" | "daily" | "weekly" | "monthly" | "yearly"
        | "weekday" | "weekend"
        | "monthly_nth_weekday"
        | "monthly_last_business_day"
        | "monthly_first_business_day"
        | "none",
    recurrenceInterval: number,
    options?: { weekday?: number | null; nth?: number | null },
): Date {
    const nextTime = new Date(currentTime);

    switch (recurrenceType) {
        case "hourly":
            nextTime.setHours(nextTime.getHours() + recurrenceInterval);
            break;
        case "daily":
            nextTime.setDate(nextTime.getDate() + recurrenceInterval);
            break;
        case "weekly":
            nextTime.setDate(nextTime.getDate() + (7 * recurrenceInterval));
            break;
        case "monthly":
            nextTime.setMonth(nextTime.getMonth() + recurrenceInterval);
            break;
        case "yearly":
            nextTime.setFullYear(nextTime.getFullYear() + recurrenceInterval);
            break;
        case "weekday":
            do {
                nextTime.setDate(nextTime.getDate() + 1);
            } while (nextTime.getDay() === 0 || nextTime.getDay() === 6);
            break;
        case "weekend": {
            const currentDay = nextTime.getDay();
            if (currentDay === 6) {
                nextTime.setDate(nextTime.getDate() + 1);
            } else if (currentDay === 0) {
                nextTime.setDate(nextTime.getDate() + 6);
            } else {
                const daysUntilSaturday = 6 - currentDay;
                nextTime.setDate(nextTime.getDate() + daysUntilSaturday);
            }
            break;
        }
        case "monthly_nth_weekday": {
            const targetMonth = nextTime.getMonth() + recurrenceInterval;
            const targetYear = nextTime.getFullYear() + Math.floor(targetMonth / 12);
            return getNthWeekdayOfMonth(
                targetYear,
                ((targetMonth % 12) + 12) % 12,
                options?.weekday ?? 1,
                options?.nth ?? 1,
                nextTime,
            );
        }
        case "monthly_last_business_day": {
            const targetMonth = nextTime.getMonth() + recurrenceInterval;
            const targetYear = nextTime.getFullYear() + Math.floor(targetMonth / 12);
            const holidays = getBrazilianHolidays(targetYear);
            return getLastBusinessDayOfMonth(
                targetYear,
                ((targetMonth % 12) + 12) % 12,
                nextTime,
                holidays,
            );
        }
        case "monthly_first_business_day": {
            const targetMonth = nextTime.getMonth() + recurrenceInterval;
            const targetYear = nextTime.getFullYear() + Math.floor(targetMonth / 12);
            const holidays = getBrazilianHolidays(targetYear);
            return getFirstBusinessDayOfMonth(
                targetYear,
                ((targetMonth % 12) + 12) % 12,
                nextTime,
                holidays,
            );
        }
        default:
            return nextTime;
    }

    return nextTime;
}

export function shouldStopRecurrence({
    sentCount,
    maxOccurrences,
    endDate,
    nextScheduledTime,
}: {
    sentCount: number;
    maxOccurrences: number | null;
    endDate: Date | null;
    nextScheduledTime: Date;
}): boolean {
    if (maxOccurrences !== null && sentCount >= maxOccurrences) return true;
    if (endDate !== null && nextScheduledTime > endDate) return true;
    return false;
}
