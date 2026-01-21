import mongoose, { Schema, Document } from "mongoose";
import { AIOperationType, AI_OPERATIONS } from "../../shared/types/ai.types";

// User Interface
export interface IUser extends Document {
    phoneNumber: string;
    name: string;

    aiUsage: {
        tokens: Array<{
            timestamp: Date;
            count: number;
            operation: AIOperationType;
        }>;
        totalTokensLast24h?: number; // Cached value, recalculated on each check
    };

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
        aiUsage: {
            type: {
                tokens: [{
                    timestamp: { type: Date, required: true },
                    count: { type: Number, required: true },
                    operation: {
                        type: String,
                        enum: AI_OPERATIONS,
                        required: true
                    },
                }],
                totalTokensLast24h: { type: Number, default: 0 },
            },
            default: () => ({ tokens: [], totalTokensLast24h: 0 }),
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

