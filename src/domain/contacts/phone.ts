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

export function phonesMatch(a: string, b: string): boolean {
    return digitsOnly(a) === digitsOnly(b);
}

export function userPhoneVariants(digits: string): string[] {
    const d = digitsOnly(digits);
    return [d, `${d}@s.whatsapp.net`];
}
