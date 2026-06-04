import mongoose, { Document, Schema } from "mongoose";

export interface IReminder extends Document {
    userPhoneNumber: string;
    title: string;
    scheduledTime: Date;
    messageId: string;
    recurrence_type:
        | "hourly" | "daily" | "weekly" | "monthly" | "yearly"
        | "weekday" | "weekend"
        | "monthly_nth_weekday"
        | "monthly_last_business_day"
        | "monthly_first_business_day"
        | "none";
    recurrence_interval: number;
    recurrence_weekday: number | null;
    recurrence_nth: number | null;
    status: "pending" | "sent" | "cancelled";
    maxOccurrences: number | null;
    endDate: Date | null;
    sentCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
    {
        userPhoneNumber: {
            type: String,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        scheduledTime: {
            type: Date,
            required: true,
        },
        messageId: {
            type: String,
            required: true,
        },
        recurrence_type: {
            type: String,
            enum: [
                "hourly", "daily", "weekly", "monthly", "yearly",
                "weekday", "weekend",
                "monthly_nth_weekday",
                "monthly_last_business_day",
                "monthly_first_business_day",
                "none",
            ],
            default: "none",
        },
        recurrence_interval: {
            type: Number,
            default: 0,
        },
        recurrence_weekday: {
            type: Number,
            default: null,
        },
        recurrence_nth: {
            type: Number,
            default: null,
        },
        status: {
            type: String,
            enum: ["pending", "sent", "cancelled"],
            default: "pending",
        },
        maxOccurrences: {
            type: Number,
            default: null,
        },
        endDate: {
            type: Date,
            default: null,
        },
        sentCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

ReminderSchema.index({ userPhoneNumber: 1, scheduledTime: 1 });
ReminderSchema.index({ status: 1, scheduledTime: 1 });

export const Reminder = mongoose.model<IReminder>("Reminder", ReminderSchema);