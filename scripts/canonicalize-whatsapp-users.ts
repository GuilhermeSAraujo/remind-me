import { ObjectId, type Db, type Document } from "mongodb";
import mongoose from "mongoose";
import { env } from "../src/config/env";
import {
    canonicalizeWhatsappUsers,
    type CanonicalizeDb,
    type PhoneIdentity,
} from "../src/domain/users/canonicalize-phone-users";

function toIdentity(doc: Document): PhoneIdentity {
    const expires = doc.premiumExpiresAt;
    return {
        _id: String(doc._id),
        phoneNumber: String(doc.phoneNumber),
        isPremium: Boolean(doc.isPremium),
        premiumExpiresAt: expires instanceof Date ? expires : undefined,
    };
}

export function mongoCanonicalizeDb(db: Db): CanonicalizeDb {
    const users = db.collection("users");
    const reminders = db.collection("reminders");
    const contacts = db.collection("contacts");
    const payments = db.collection("premiumpayments");

    return {
        async listJidUsers() {
            const rows = await users.find({ phoneNumber: /@s\.whatsapp\.net$/ }).toArray();
            return rows.map(toIdentity);
        },
        async findUserByPhone(phone: string) {
            const doc = await users.findOne({ phoneNumber: phone });
            return doc ? toIdentity(doc) : null;
        },
        async setUserPhone(id: string, phone: string) {
            await users.updateOne({ _id: new ObjectId(id) }, { $set: { phoneNumber: phone } });
        },
        async setPremium(id: string, isPremium: boolean, premiumExpiresAt: Date | undefined) {
            const $set: { isPremium: boolean; premiumExpiresAt?: Date } = { isPremium };
            if (premiumExpiresAt) {
                $set.premiumExpiresAt = premiumExpiresAt;
            }
            await users.updateOne({ _id: new ObjectId(id) }, { $set });
        },
        async deleteUser(id: string) {
            await users.deleteOne({ _id: new ObjectId(id) });
        },
        async replacePhone(from: string, to: string) {
            await reminders.updateMany({ userPhoneNumber: from }, { $set: { userPhoneNumber: to } });
            await reminders.updateMany({ createdByPhoneNumber: from }, { $set: { createdByPhoneNumber: to } });
            await contacts.updateMany({ inviterPhoneNumber: from }, { $set: { inviterPhoneNumber: to } });
            await contacts.updateMany({ inviteePhoneNumber: from }, { $set: { inviteePhoneNumber: to } });
            await payments.updateMany({ userPhoneNumber: from }, { $set: { userPhoneNumber: to } });
        },
    };
}

await mongoose.connect(env.MONGODB_URI);
const db = mongoose.connection.db;
if (!db) {
    throw new Error("Mongo connection has no database");
}

const summary = await canonicalizeWhatsappUsers(mongoCanonicalizeDb(db));
console.info("[canonicalize] done", summary);
await mongoose.disconnect();
