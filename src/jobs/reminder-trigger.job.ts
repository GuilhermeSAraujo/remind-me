import { Reminder } from "../domain/reminders/reminder.model";
import { getBrazilTime } from "../shared/utils/date.utils";
import { sendMessage } from "../integrations/whatsapp/send-message";

export async function triggerReminders() {
    const now = new Date(getBrazilTime());

    console.info(`[CRON] Starting at ${now.toLocaleString()}`);

    // Find reminders that are pending and whose scheduled time has passed
    const reminders = await Reminder.find({
        status: "pending",
        scheduledTime: { $lte: now }
    });

    if (reminders.length === 0) {
        return
    }

    console.info(`[CRON] Processing ${reminders.length} reminders`);

    for await (const reminder of reminders) {
        try {
            const success = await sendMessage({
                phone: reminder.userPhoneNumber,
                message: reminder.title,
            });

            if (!success) {
                console.error(`[CRON] Failed to send reminder:`, { title: reminder.title, phone: reminder.userPhoneNumber });
                continue;
            }

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

            } else {
                // Non-recurring reminder, mark as sent
                await Reminder.updateOne({ _id: reminder._id }, { status: "sent" });

            }
        } catch (error) {
            console.error(`[CRON] Failed to send reminder:`, { title: reminder.title, phone: reminder.userPhoneNumber, error });
        }
    }

    console.info(`[CRON] Completed - sent ${reminders.length} reminders`);
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

