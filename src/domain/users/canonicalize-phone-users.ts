const WHATSAPP_JID_SUFFIX = "@s.whatsapp.net";

export function whatsappJidDigits(phone: string): string | null {
    if (!phone.endsWith(WHATSAPP_JID_SUFFIX)) {
        return null;
    }
    const local = phone.slice(0, -WHATSAPP_JID_SUFFIX.length);
    if (!/^\d+$/.test(local)) {
        return null;
    }
    return local;
}

export type PhoneIdentity = {
    _id: string;
    phoneNumber: string;
    isPremium: boolean;
    premiumExpiresAt?: Date;
    aiUsageTotal?: number;
};

export interface CanonicalizeDb {
    listJidUsers(): Promise<PhoneIdentity[]>;
    findUserByPhone(phone: string): Promise<PhoneIdentity | null>;
    setUserPhone(id: string, phone: string): Promise<void>;
    setPremium(id: string, isPremium: boolean, premiumExpiresAt: Date | undefined): Promise<void>;
    deleteUser(id: string): Promise<void>;
    replacePhone(from: string, to: string): Promise<void>;
}

export type CanonicalizeSummary = {
    merged: number;
    renamed: number;
    skipped: number;
};

/**
 * Point reminder, contact, and payment phones that use `digits@s.whatsapp.net`
 * at the bare-digit user. Suffixes such as `-disabled` are not JID locals and are skipped.
 */
export async function canonicalizeWhatsappUsers(db: CanonicalizeDb): Promise<CanonicalizeSummary> {
    const summary: CanonicalizeSummary = { merged: 0, renamed: 0, skipped: 0 };
    const aliases = await db.listJidUsers();

    for (const alias of aliases) {
        const digits = whatsappJidDigits(alias.phoneNumber);
        if (!digits) {
            summary.skipped++;
            continue;
        }

        const canonical = await db.findUserByPhone(digits);
        await db.replacePhone(alias.phoneNumber, digits);

        if (canonical) {
            const premium = mergedPremium(canonical, alias);
            if (premium) {
                await db.setPremium(canonical._id, premium.isPremium, premium.premiumExpiresAt);
            }
            await db.deleteUser(alias._id);
            summary.merged++;
            continue;
        }

        await db.setUserPhone(alias._id, digits);
        summary.renamed++;
    }

    return summary;
}

function mergedPremium(
    kept: PhoneIdentity,
    alias: PhoneIdentity,
): { isPremium: boolean; premiumExpiresAt?: Date } | null {
    const keptTime = kept.premiumExpiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const aliasTime = alias.premiumExpiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const isPremium = kept.isPremium || alias.isPremium;
    const premiumExpiresAt = aliasTime > keptTime ? alias.premiumExpiresAt : kept.premiumExpiresAt;
    if (isPremium === kept.isPremium && premiumExpiresAt === kept.premiumExpiresAt) {
        return null;
    }
    return { isPremium, premiumExpiresAt };
}
