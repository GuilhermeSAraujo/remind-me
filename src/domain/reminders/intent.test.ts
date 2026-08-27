import { describe, expect, it } from "vitest";
import { detectMessageIntent } from "./intent";

describe("detectMessageIntent", () => {
    it("detects delay with explicit duration", () => {
        expect(detectMessageIntent("Adiar 30 minutos")).toBe("delay_reminder");
        expect(detectMessageIntent("atrasar 2 horas")).toBe("delay_reminder");
    });

    it("does not treat digit-only as delay", () => {
        expect(detectMessageIntent("1")).toBeNull();
    });

    it("still detects other intents from first words", () => {
        expect(detectMessageIntent("lista meus lembretes")).toBe("list_reminders");
        expect(detectMessageIntent("apagar 2")).toBe("delete_reminder");
    });

    it("detects register_contact from cadastrar", () => {
        expect(detectMessageIntent("Cadastrar pessoa (31)999999999 Victor")).toBe(
            "register_contact",
        );
    });

    it("detects list_contacts from Contatos and meus contatos", () => {
        expect(detectMessageIntent("Contatos")).toBe("list_contacts");
        expect(detectMessageIntent("meus contatos")).toBe("list_contacts");
    });
});
