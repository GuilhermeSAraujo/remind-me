export function calculateNextScheduledTime(
    currentTime: Date,
    recurrenceType: "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "none",
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
        default:
            // Should not reach here, but return current time as fallback
            return nextTime;
    }

    return nextTime;
}
