export function calculateNextScheduledTime(
    currentTime: Date,
    recurrenceType: "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "weekday" | "weekend" | "none",
    recurrenceInterval: number
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
            // Avançar para o próximo dia útil (seg-sex) mantendo o horário
            do {
                nextTime.setDate(nextTime.getDate() + 1);
            } while (nextTime.getDay() === 0 || nextTime.getDay() === 6); // 0=domingo, 6=sábado
            break;
        case "weekend":
            // Avançar para o próximo fim de semana (sáb/dom) mantendo o horário
            const currentDay = nextTime.getDay();
            if (currentDay === 6) { // Sábado
                nextTime.setDate(nextTime.getDate() + 1); // Próximo domingo
            } else if (currentDay === 0) { // Domingo
                nextTime.setDate(nextTime.getDate() + 6); // Próximo sábado
            } else { // Segunda a sexta
                const daysUntilSaturday = 6 - currentDay;
                nextTime.setDate(nextTime.getDate() + daysUntilSaturday);
            }
            break;
        default:
            // Should not reach here, but return current time as fallback
            return nextTime;
    }

    return nextTime;
}
