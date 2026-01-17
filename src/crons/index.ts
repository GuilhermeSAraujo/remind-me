import { CronJob } from "cron";
import { triggerReminders } from "./reminder";

CronJob.from({
    // every minute
    cronTime: '* * * * *',
    name: 'reminder-job',
    onTick: triggerReminders,
    timeZone: 'America/Sao_Paulo',
    start: true,
});
