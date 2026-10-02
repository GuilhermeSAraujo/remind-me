import mongoose, { Schema, Document } from "mongoose";

// User Interface
export interface IUser extends Document {
    phoneNumber: string;
    name: string;

    reminderCreations: Date[];

    // Premium status
    isPremium: boolean;
    premiumExpiresAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

// Reminder Interface


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
        reminderCreations: {
            type: [Date],
            default: () => [],
        },
        isPremium: {
            type: Boolean,
            default: false,
        },
        premiumExpiresAt: {
            type: Date,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

// Reminder Schema


// Create indexes for better query performance


// Export Models
export const User = mongoose.model<IUser>("User", UserSchema);
