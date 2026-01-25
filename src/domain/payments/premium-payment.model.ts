import mongoose, { Schema, Document } from "mongoose";

// PremiumPayment Interface
export interface IPremiumPayment extends Document {
    userPhoneNumber: string;
    messageSent: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// PremiumPayment Schema
const PremiumPaymentSchema = new Schema<IPremiumPayment>(
    {
        userPhoneNumber: {
            type: String,
            ref: "User",
            required: true,
            trim: true,
        },
        messageSent: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Create indexes for better query performance
PremiumPaymentSchema.index({ userPhoneNumber: 1 });
PremiumPaymentSchema.index({ messageSent: 1, createdAt: 1 });

// TTL index to automatically delete records after 30 days
PremiumPaymentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

// Export Model
export const PremiumPayment = mongoose.model<IPremiumPayment>("PremiumPayment", PremiumPaymentSchema);
