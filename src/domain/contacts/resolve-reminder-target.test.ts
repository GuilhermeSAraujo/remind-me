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
