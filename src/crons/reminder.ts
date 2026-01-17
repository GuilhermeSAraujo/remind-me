import { Reminder } from "../db/schemas";
import { sendMessage } from "../whatsApp";

export async function triggerReminders() {
    const now = new Date();

    // Find reminders that are pending and whose scheduled time has passed
    const reminders = await Reminder.find({
        status: "pending",
        scheduledTime: { $lte: now }
    });

    if (reminders.length === 0) {
        const totalReminders = await Reminder.countDocuments({});
        console.log(`[CRON] Ran successfully, no reminders to send`, { totalReminders });
        return
    }

    console.log(`[CRON] Found ${reminders.length} reminders to send`);

    for await (const reminder of reminders) {
        try {
            await sendMessage({
                phone: reminder.userPhoneNumber,
                message: reminder.title,
            });

            // Handle recurring reminders
            if (reminder.recurrence_type !== "none" && reminder.recurrence_interval > 0) {
                const nextScheduledTime = calculateNextScheduledTime(
                    reminder.scheduledTime,
                    reminder.recurrence_type,
                    reminder.recurrence_interval
                );

                await Reminder.updateOne(
                    { _id: reminder._id },
                    { scheduledTime: nextScheduledTime }
                );
                return;

            } else {
                // Non-recurring reminder, mark as sent
                await Reminder.updateOne({ _id: reminder._id }, { status: "sent" });
                return;

            }
        } catch (error) {
            console.error(`Error sending reminder: ${reminder.title} to ${reminder.userPhoneNumber}`, error);
        }
    }

    console.log(`[CRON] Sent ${reminders.length} reminders`);
}

function calculateNextScheduledTime(
    currentTime: Date,
    recurrenceType: "daily" | "weekly" | "monthly" | "yearly" | "none",
    recurrenceInterval: number
): Date {
    const nextTime = new Date(currentTime);

    switch (recurrenceType) {
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