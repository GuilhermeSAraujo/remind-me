import { describe, expect, it } from "vitest";
import {
    canonicalizeWhatsappUsers,
    whatsappJidDigits,
    type CanonicalizeDb,
    type PhoneIdentity,
} from "./canonicalize-phone-users";

function user(partial: Partial<PhoneIdentity> & Pick<PhoneIdentity, "phoneNumber">): PhoneIdentity {
    return {
        _id: partial.phoneNumber,
        isPremium: false,
        ...partial,
    };
}

describe("whatsappJidDigits", () => {
    it("accepts only an all-digit local part plus @s.whatsapp.net", () => {
        expect(whatsappJidDigits("553199777722@s.whatsapp.net")).toBe("553199777722");
        expect(whatsappJidDigits("553199777722")).toBeNull();
        expect(whatsappJidDigits("553199777722-disabled")).toBeNull();
        expect(whatsappJidDigits("553196381352-1531693972")).toBeNull();
        expect(whatsappJidDigits("107116551475437")).toBeNull();
        expect(whatsappJidDigits("553199777722@lid")).toBeNull();
    });
});

describe("canonicalizeWhatsappUsers", () => {
    it("moves JID reminders and contacts onto the bare-digit user and keeps the later premium expiry", async () => {
        const digit = user({
            phoneNumber: "553199777722",
            isPremium: true,
            premiumExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
            aiUsageTotal: 2801,
        });
        const jid = user({
            phoneNumber: "553199777722@s.whatsapp.net",
            isPremium: true,
            premiumExpiresAt: new Date("2028-08-02T00:00:00.000Z"),
            aiUsageTotal: 23276,
        });
        const reminders = [
            { userPhoneNumber: jid.phoneNumber, createdByPhoneNumber: undefined, title: "Passar fio dental" },
            { userPhoneNumber: jid.phoneNumber, createdByPhoneNumber: undefined, title: "Dar comida para o spike" },
            { userPhoneNumber: digit.phoneNumber, createdByPhoneNumber: digit.phoneNumber, title: "Dar comida para o spike" },
        ];
        const contacts = [
            { inviterPhoneNumber: jid.phoneNumber, inviteePhoneNumber: "553188569411" },
        ];
        const payments = [{ userPhoneNumber: jid.phoneNumber }];

        const db = memoryDb([digit, jid], reminders, contacts, payments);
        const summary = await canonicalizeWhatsappUsers(db);

        expect(summary).toEqual({ merged: 1, renamed: 0, skipped: 0 });
        expect(db.users.map((row) => row.phoneNumber)).toEqual(["553199777722"]);
        expect(db.users[0]?.premiumExpiresAt?.toISOString()).toBe("2028-08-02T00:00:00.000Z");
        expect(db.users[0]?.isPremium).toBe(true);
        expect(db.users[0]?.aiUsageTotal).toBe(2801);
        expect(reminders.map((row) => row.userPhoneNumber)).toEqual([
            "553199777722",
            "553199777722",
            "553199777722",
        ]);
        expect(reminders).toHaveLength(3);
        expect(contacts[0]).toEqual({
            inviterPhoneNumber: "553199777722",
            inviteePhoneNumber: "553188569411",
        });
        expect(payments[0]?.userPhoneNumber).toBe("553199777722");
    });

    it("renames a JID-only user to digits and rewrites their reminders", async () => {
        const jid = user({ phoneNumber: "553184465970@s.whatsapp.net", isPremium: true });
        const reminders = [
            { userPhoneNumber: jid.phoneNumber, createdByPhoneNumber: jid.phoneNumber, title: "Regar as plantas" },
        ];
        const db = memoryDb([jid], reminders, [], []);

        const summary = await canonicalizeWhatsappUsers(db);

        expect(summary).toEqual({ merged: 0, renamed: 1, skipped: 0 });
        expect(db.users).toEqual([
            expect.objectContaining({ _id: jid._id, phoneNumber: "553184465970" }),
        ]);
        expect(reminders[0]).toEqual({
            userPhoneNumber: "553184465970",
            createdByPhoneNumber: "553184465970",
            title: "Regar as plantas",
        });
    });

    it("skips a JID whose local part is not all digits", async () => {
        const weird = user({ phoneNumber: "not-a-phone@s.whatsapp.net" });
        const db = memoryDb([weird], [], [], []);

        const summary = await canonicalizeWhatsappUsers(db);

        expect(summary).toEqual({ merged: 0, renamed: 0, skipped: 1 });
        expect(db.users).toEqual([weird]);
    });
});

function memoryDb(
    users: PhoneIdentity[],
    reminders: { userPhoneNumber: string; createdByPhoneNumber?: string; title: string }[],
    contacts: { inviterPhoneNumber: string; inviteePhoneNumber: string }[],
    payments: { userPhoneNumber: string }[],
): CanonicalizeDb & {
    users: PhoneIdentity[];
} {
    return {
        users,
        async listJidUsers() {
            return users.filter((row) => row.phoneNumber.endsWith("@s.whatsapp.net"));
        },
        async findUserByPhone(phone: string) {
            return users.find((row) => row.phoneNumber === phone) ?? null;
        },
        async setUserPhone(id: string, phone: string) {
            const row = users.find((user) => user._id === id);
            if (row) {
                row.phoneNumber = phone;
            }
        },
        async setPremium(id: string, isPremium: boolean, premiumExpiresAt: Date | undefined) {
            const row = users.find((user) => user._id === id);
            if (row) {
                row.isPremium = isPremium;
                row.premiumExpiresAt = premiumExpiresAt;
            }
        },
        async deleteUser(id: string) {
            const index = users.findIndex((row) => row._id === id);
            if (index >= 0) {
                users.splice(index, 1);
            }
        },
        async replacePhone(from: string, to: string) {
            for (const reminder of reminders) {
                if (reminder.userPhoneNumber === from) {
                    reminder.userPhoneNumber = to;
                }
                if (reminder.createdByPhoneNumber === from) {
                    reminder.createdByPhoneNumber = to;
                }
            }
            for (const contact of contacts) {
                if (contact.inviterPhoneNumber === from) {
                    contact.inviterPhoneNumber = to;
                }
                if (contact.inviteePhoneNumber === from) {
                    contact.inviteePhoneNumber = to;
                }
            }
            for (const payment of payments) {
                if (payment.userPhoneNumber === from) {
                    payment.userPhoneNumber = to;
                }
            }
        },
    };
}
