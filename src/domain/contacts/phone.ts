export function digitsOnly(phone: string): string {
    return phone.replace(/\D/g, "");
}

export function normalizeBrazilPhone(input: string): string | null {
    const digits = digitsOnly(input);
    if (digits.length === 10 || digits.length === 11) {
        return `55${digits}`;
    }
    if (digits.length === 12 || digits.length === 13) {
        if (digits.startsWith("55")) {
            return digits;
        }
        return null;
    }
    return null;
}

/** Digits for Contact storage: Brazil-normalize when possible, else strip non-digits. */
export function contactDigits(phone: string): string {
    return normalizeBrazilPhone(phone) ?? digitsOnly(phone);
}

/**
 * Digit forms of a Brazilian mobile that WhatsApp may use: with and without
 * the extra 9 after DDD (55 + DD + 9 + 8 vs 55 + DD + 8).
 */
export function brazilianPhoneVariants(phone: string): string[] {
    const variants = new Set<string>();
    const digits = digitsOnly(phone);
    if (digits) {
        variants.add(digits);
    }
    const normalized = normalizeBrazilPhone(phone);
    if (normalized) {
        variants.add(normalized);
    }

    for (const base of [...variants]) {
        if (!base.startsWith("55")) {
            continue;
        }
        if (base.length === 13 && base[4] === "9") {
            variants.add(base.slice(0, 4) + base.slice(5));
        } else if (base.length === 12) {
            variants.add(base.slice(0, 4) + "9" + base.slice(4));
        }
    }

    return [...variants];
}

export function phonesMatch(a: string, b: string): boolean {
    const other = new Set(brazilianPhoneVariants(b));
    return brazilianPhoneVariants(a).some((variant) => other.has(variant));
}

export function userPhoneVariants(phone: string): string[] {
    const keys: string[] = [];
    for (const digits of brazilianPhoneVariants(phone)) {
        keys.push(digits, `${digits}@s.whatsapp.net`);
    }
    return keys;
}

export function phoneLookupKeys(phone: string): string[] {
    return userPhoneVariants(phone);
}
