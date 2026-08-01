import { describe, expect, it } from "vitest";
import { DELAY_REMINDER_PATTERN, detectMessageIntent } from "./intent";

describe("DELAY_REMINDER_PATTERN", () => {
    it.each([
        "Adiar 30 minutos",
        "atrasar 2 horas",
        "delay de 15 minutos",
        "Adiar 1 dia",
        "adia 10 minutos",
        "delay 5 horas",
    ])("matches %s", (message) => {
        expect(DELAY_REMINDER_PATTERN.test(message)).toBe(true);
    });

    it.each(["1", "30", "amanhã", "Adiar", "adiar lembrete", "ok"])(
        "does not match %s",
        (message) => {
            expect(DELAY_REMINDER_PATTERN.test(message)).toBe(false);
        },
    );
});

describe("detectMessageIntent", () => {
    it("detects delay with explicit duration", () => {
        expect(detectMessageIntent("Adiar 30 minutos")).toBe("delay_reminder");
        expect(detectMessageIntent("delay de 2 horas")).toBe("delay_reminder");
    });

    it("does not treat digit-only or bare delay as delay", () => {
        expect(detectMessageIntent("1")).toBeNull();
        expect(detectMessageIntent("Adiar")).toBeNull();
    });

    it("still detects other intents from first words", () => {
        expect(detectMessageIntent("lista meus lembretes")).toBe("list_reminders");
        expect(detectMessageIntent("apagar 2")).toBe("delete_reminder");
    });
});
