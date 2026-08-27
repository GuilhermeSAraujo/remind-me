import { describe, expect, it } from "vitest";
import {
    digitsOnly,
    normalizeBrazilPhone,
    phonesMatch,
    userPhoneVariants,
} from "./phone";

describe("digitsOnly", () => {
    it("strips formatting and JID suffix", () => {
        expect(digitsOnly("(31)999999999")).toBe("31999999999");
        expect(digitsOnly("5531999999999@s.whatsapp.net")).toBe("5531999999999");
        expect(digitsOnly("+55 31 99999-9999")).toBe("5531999999999");
    });
});

describe("normalizeBrazilPhone", () => {
    it("prepends 55 for 10–11 digit local numbers", () => {
        expect(normalizeBrazilPhone("(31)999999999")).toBe("5531999999999");
        expect(normalizeBrazilPhone("31999999999")).toBe("5531999999999");
        expect(normalizeBrazilPhone("3133334444")).toBe("553133334444");
    });

    it("keeps numbers that already include 55", () => {
        expect(normalizeBrazilPhone("5531999999999")).toBe("5531999999999");
        expect(normalizeBrazilPhone("+55 31 99999-9999")).toBe("5531999999999");
    });

    it("returns null when too short or missing DDD", () => {
        expect(normalizeBrazilPhone("999999999")).toBeNull();
        expect(normalizeBrazilPhone("abc")).toBeNull();
        expect(normalizeBrazilPhone("")).toBeNull();
    });
});

describe("phonesMatch", () => {
    it("matches digits to WhatsApp JID", () => {
        expect(phonesMatch("5531999999999", "5531999999999@s.whatsapp.net")).toBe(true);
        expect(phonesMatch("5531999999999", "5531888888888")).toBe(false);
    });
});

describe("userPhoneVariants", () => {
    it("returns digits and s.whatsapp.net JID", () => {
        expect(userPhoneVariants("5531999999999")).toEqual([
            "5531999999999",
            "5531999999999@s.whatsapp.net",
        ]);
    });
});
