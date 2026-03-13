import PQueue from "p-queue";

const reminderQueue = new PQueue({ concurrency: 5 });

/**
 * Enqueues a reminder job (fire-and-forget). Use to free the request thread
 * while scheduleReminder runs in the background.
 */
export function enqueueReminder(fn: () => Promise<void>): void {
  reminderQueue.add(fn);
}
