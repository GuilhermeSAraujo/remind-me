import { describe, expect, it } from "vitest";
import {
    resolveReminderTargetFromContacts,
    stripContactTarget,
} from "./resolve-reminder-target";

const contacts = [{ nickname: "Isabela", otherPhoneDigits: "5531111111111" }];

describe("resolveReminderTargetFromContacts", () => {
    it("treats me lembre as self even if a contact name appears", () => {
        expect(
            resolveReminderTargetFromContacts(
                "Me lembre de ligar para a Isabela amanhã 10h",
                contacts,
            ),
        ).toEqual({ kind: "self" });
    });

    it("resolves Lembre a {nome} to that contact", () => {
        expect(
            resolveReminderTargetFromContacts(
                "Lembre a Isabela amanhã 12h de passear com o cachorro",
                contacts,
            ),
        ).toEqual({
            kind: "contact",
            nickname: "Isabela",
            ownerPhoneDigits: "5531111111111",
        });
    });

    it("returns unknown_name when targeting a name that is not a contact", () => {
        expect(
            resolveReminderTargetFromContacts("Lembre a Maria amanhã 10h de x", contacts),
        ).toEqual({ kind: "unknown_name", name: "Maria" });
    });

    it("treats self-reminder phrasing with bare para as self even with contacts", () => {
        for (const message of [
            "Lembrete para ir ao médico amanhã às 10h",
            "Lembrete para reunião amanhã 15:30",
            "Crie um lembrete para comprar pão",
        ]) {
            expect(resolveReminderTargetFromContacts(message, contacts)).toEqual({
                kind: "self",
            });
        }
    });

    it("falls back to self when targeting a name but the sender has no accepted contacts", () => {
        expect(
            resolveReminderTargetFromContacts("Lembre a Maria amanhã 10h de x", []),
        ).toEqual({ kind: "self" });
    });

    it("resolves a nickname followed by a comma", () => {
        expect(
            resolveReminderTargetFromContacts(
                "Lembre a Isabela, amanhã 12h de passear com o cachorro",
                contacts,
            ),
        ).toEqual({
            kind: "contact",
            nickname: "Isabela",
            ownerPhoneDigits: "5531111111111",
        });
    });

    it("resolves accented nicknames when more text follows", () => {
        const joseContacts = [{ nickname: "José", otherPhoneDigits: "5532222222222" }];
        expect(
            resolveReminderTargetFromContacts("Lembre a José amanhã 10h de x", joseContacts),
        ).toEqual({
            kind: "contact",
            nickname: "José",
            ownerPhoneDigits: "5532222222222",
        });
    });
});

describe("stripContactTarget", () => {
    it("removes the targeting phrase so extract sees the task", () => {
        const stripped = stripContactTarget(
            "Lembre a Isabela amanhã 12h de passear com o cachorro",
            "Isabela",
        );
        expect(stripped.toLowerCase()).not.toContain("isabela");
        expect(stripped.toLowerCase()).toContain("passear");
    });
});
