import { Reminder } from "../domain/reminders/reminder.model";
import { sendMessage } from "../integrations/whatsapp/send-message";
import { getRandomPrefix } from "../shared/utils/reminder-prefix.utils";
import { calculateNextScheduledTime, shouldStopRecurrence } from "../domain/reminders/recurrence.utils";

export async function triggerReminders() {
    const now = new Date();

    console.info(`[CRON] Starting at ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);

    const reminders = await Reminder.find({
        status: "pending",
        scheduledTime: { $lte: now },
    });

    if (reminders.length === 0) {
        return;
    }

    console.info(`[CRON] Processing ${reminders.length} reminders`);

    let failedReminders = 0;
    for (const reminder of reminders) {
        try {
            const success = await sendMessage({
                phone: reminder.userPhoneNumber,
                message: getRandomPrefix() + reminder.title,
            });

            if (!success) {
                console.error(`[CRON] Failed to send reminder:`, {
                    title: reminder.title,
                    phone: reminder.userPhoneNumber,
                });
                failedReminders++;
                continue;
            }

            const newSentCount = reminder.sentCount + 1;

            if (reminder.recurrence_type !== "none" && reminder.recurrence_interval > 0) {
                const nextScheduledTime = calculateNextScheduledTime(
                    reminder.scheduledTime,
                    reminder.recurrence_type,
                    reminder.recurrence_interval,
                );

                const stop = shouldStopRecurrence({
                    sentCount: newSentCount,
                    maxOccurrences: reminder.maxOccurrences,
                    endDate: reminder.endDate,
                    nextScheduledTime,
                });

                if (stop) {
                    await Reminder.updateOne({ _id: reminder._id }, { status: "sent", sentCount: newSentCount });
                } else {
                    await Reminder.updateOne({ _id: reminder._id }, { scheduledTime: nextScheduledTime, sentCount: newSentCount });
                }
            } else {
                await Reminder.updateOne({ _id: reminder._id }, { status: "sent", sentCount: newSentCount });
            }
        } catch (error) {
            console.error(`[CRON] Failed to send reminder:`, {
                title: reminder.title,
                phone: reminder.userPhoneNumber,
                error,
            });
        }
    }

    console.info(`[CRON] Completed - sent ${reminders.length - failedReminders} reminders`);
}
