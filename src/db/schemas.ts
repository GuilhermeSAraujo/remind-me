import mongoose, { Schema, Document } from "mongoose";

// User Interface
export interface IUser extends Document {
    phoneNumber: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

// Reminder Interface
export interface IReminder extends Document {
    userPhoneNumber: string;
    title: string;
    scheduledTime: Date;
    messageId: string;
    recurrence_type: "daily" | "weekly" | "monthly" | "yearly" | "none";
    recurrence_interval: number;
    status: "pending" | "sent" | "cancelled";
    createdAt: Date;
    updatedAt: Date;
}

// User Schema
const UserSchema = new Schema<IUser>(
    {
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Reminder Schema
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
            enum: ["daily", "weekly", "monthly", "yearly", "none"],
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

// Create indexes for better query performance
ReminderSchema.index({ userPhoneNumber: 1, scheduledTime: 1 });
ReminderSchema.index({ status: 1, scheduledTime: 1 });

// Export Models
export const User = mongoose.model<IUser>("User", UserSchema);
export const Reminder = mongoose.model<IReminder>("Reminder", ReminderSchema);

