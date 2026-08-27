import mongoose, { Document, Schema } from "mongoose";

export type ContactStatus = "pending" | "accepted" | "rejected";

export interface IContact extends Document {
    inviterPhoneNumber: string;
    inviteePhoneNumber: string;
    inviterNicknameForInvitee: string;
    inviteeNicknameForInviter: string | null;
    status: ContactStatus;
    inviteMessageId: string;
    createdAt: Date;
    updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
    {
        inviterPhoneNumber: { type: String, required: true },
        inviteePhoneNumber: { type: String, required: true },
        inviterNicknameForInvitee: { type: String, required: true, trim: true },
        inviteeNicknameForInviter: { type: String, default: null, trim: true },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },
        inviteMessageId: { type: String, required: true, default: "" },
    },
    { timestamps: true },
);

ContactSchema.index({ inviterPhoneNumber: 1, inviteePhoneNumber: 1 }, { unique: true });
ContactSchema.index({ inviteePhoneNumber: 1, status: 1, updatedAt: -1 });
ContactSchema.index({ inviteMessageId: 1 });

export const Contact = mongoose.model<IContact>("Contact", ContactSchema);
