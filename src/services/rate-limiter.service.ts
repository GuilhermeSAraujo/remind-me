import { User } from "../domain/users/user.model";
import { FREE_REMINDERS_PER_24H, REMINDER_QUOTA_WINDOW_HOURS } from "./reminder-quota";

export interface ReminderCreationLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
    isPremium: boolean;
}

function isActivePremium(user: { isPremium: boolean; premiumExpiresAt?: Date }): boolean {
    return Boolean(user.isPremium && user.premiumExpiresAt && user.premiumExpiresAt > new Date());
}

function recentCreations(timestamps: Date[], now: Date): Date[] {
    const windowStart = new Date(now.getTime() - REMINDER_QUOTA_WINDOW_HOURS * 60 * 60 * 1000);
    return timestamps.filter((timestamp) => new Date(timestamp) > windowStart);
}

function resetInMs(recent: Date[], now: Date): number {
    if (recent.length === 0) {
        return REMINDER_QUOTA_WINDOW_HOURS * 60 * 60 * 1000;
    }
    const oldestTimestamp = Math.min(...recent.map((timestamp) => new Date(timestamp).getTime()));
    return Math.max(0, oldestTimestamp + REMINDER_QUOTA_WINDOW_HOURS * 60 * 60 * 1000 - now.getTime());
}

export async function checkReminderCreationLimit(
    phoneNumber: string,
): Promise<ReminderCreationLimitResult> {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
        throw new Error("User not found");
    }

    if (isActivePremium(user)) {
        return {
            allowed: true,
            remaining: -1,
            resetIn: 0,
            isPremium: true,
        };
    }

    const now = new Date();
    const recent = recentCreations(user.reminderCreations ?? [], now);

    if (recent.length >= FREE_REMINDERS_PER_24H) {
        return {
            allowed: false,
            remaining: 0,
            resetIn: resetInMs(recent, now),
            isPremium: false,
        };
    }

    return {
        allowed: true,
        remaining: FREE_REMINDERS_PER_24H - recent.length,
        resetIn: resetInMs(recent, now),
        isPremium: false,
    };
}

export async function recordReminderCreation(phoneNumber: string): Promise<void> {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
        throw new Error("User not found");
    }

    if (isActivePremium(user)) {
        return;
    }

    const now = new Date();
    const cleanupTime = new Date(now.getTime() - (REMINDER_QUOTA_WINDOW_HOURS + 1) * 60 * 60 * 1000);
    user.reminderCreations = [...(user.reminderCreations ?? []), now].filter(
        (timestamp) => new Date(timestamp) > cleanupTime,
    );

    await user.save();
}

export { FREE_REMINDERS_PER_24H };
