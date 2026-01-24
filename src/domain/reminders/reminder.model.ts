import mongoose, { Document, Schema } from "mongoose";

export interface IReminder extends Document {
    userPhoneNumber: string;
    title: string;
    scheduledTime: Date;
    messageId: string;
    recurrence_type: "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "none";
    recurrence_interval: number;
    status: "pending" | "sent" | "cancelled";
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
            enum: ["hourly", "daily", "weekly", "monthly", "yearly", "none"],
            default: "none",
        },
        recurrence_interval: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["pending", "sent", "cancelled"],
            default: "pending",
        },
    },
    {
        timestamps: true,
    }
);

ReminderSchema.index({ userPhoneNumber: 1, scheduledTime: 1 });
ReminderSchema.index({ status: 1, scheduledTime: 1 });

export const Reminder = mongoose.model<IReminder>("Reminder", ReminderSchema);
