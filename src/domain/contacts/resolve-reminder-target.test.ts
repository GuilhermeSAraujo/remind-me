import { describe, expect, it } from "vitest";
import { reminderTargetFromAnswers } from "../../integrations/decision-ai/classify-reminder-target";
import { stripContactTarget } from "./resolve-reminder-target";

const contacts = [{ nickname: "Isabela", otherPhoneDigits: "5531111111111" }];

describe("reminderTargetFromAnswers", () => {
    it("treats a self choice as self even when a contact exists", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "self", confidence: 0.9 },
                addressee: { choice: "Isabela", confidence: 0.9 },
            }),
        ).toEqual({ kind: "self" });
    });

    it("copies the stored contact when that roster id is chosen", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "c0", confidence: 0.9 },
                addressee: { choice: "none", confidence: 0.9 },
            }),
        ).toEqual({
            kind: "contact",
            nickname: "Isabela",
            ownerPhoneDigits: "5531111111111",
        });
    });

    it("copies the stored nickname when a diminutive was the spoken name", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "c0", confidence: 0.8 },
                addressee: { choice: "Isa", confidence: 0.8 },
            }),
        ).toEqual({
            kind: "contact",
            nickname: "Isabela",
            ownerPhoneDigits: "5531111111111",
        });
    });

    it("returns unknown_name when the recipient is someone outside the roster", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "other", confidence: 0.9 },
                addressee: { choice: "Maria", confidence: 0.9 },
            }),
        ).toEqual({ kind: "unknown_name", name: "Maria" });
    });

    it("returns unknown_name without a name when no addressee token was chosen", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "other", confidence: 0.9 },
                addressee: { choice: "none", confidence: 0.9 },
            }),
        ).toEqual({ kind: "unknown_name" });
    });

    it("returns unknown_name without a name when the addressee token is below the floor", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "other", confidence: 0.9 },
                addressee: { choice: "Maria", confidence: 0.49 },
            }),
        ).toEqual({ kind: "unknown_name" });
    });

    it("accepts a contact choice at the confidence floor", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "c0", confidence: 0.5 },
                addressee: { choice: "none", confidence: 0.5 },
            }),
        ).toEqual({
            kind: "contact",
            nickname: "Isabela",
            ownerPhoneDigits: "5531111111111",
        });
    });

    it("returns unknown_name for a named person when the sender has no contacts", () => {
        expect(
            reminderTargetFromAnswers([], {
                recipient: { choice: "other", confidence: 0.9 },
                addressee: { choice: "Maria", confidence: 0.9 },
            }),
        ).toEqual({ kind: "unknown_name", name: "Maria" });
    });

    it("resolves an accented nickname from its roster id", () => {
        const joseContacts = [{ nickname: "José", otherPhoneDigits: "5532222222222" }];
        expect(
            reminderTargetFromAnswers(joseContacts, {
                recipient: { choice: "c0", confidence: 0.9 },
                addressee: { choice: "none", confidence: 0.2 },
            }),
        ).toEqual({
            kind: "contact",
            nickname: "José",
            ownerPhoneDigits: "5532222222222",
        });
    });

    it("falls back to self when a contact choice is below the confidence floor", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "c0", confidence: 0.49 },
                addressee: { choice: "Isabela", confidence: 0.9 },
            }),
        ).toEqual({ kind: "self" });
    });

    it("falls back to self when other is below the confidence floor", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "other", confidence: 0.49 },
                addressee: { choice: "Maria", confidence: 0.9 },
            }),
        ).toEqual({ kind: "self" });
    });

    it("falls back to self when the roster id does not exist", () => {
        expect(
            reminderTargetFromAnswers(contacts, {
                recipient: { choice: "c3", confidence: 0.9 },
                addressee: { choice: "none", confidence: 0.9 },
            }),
        ).toEqual({ kind: "self" });
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

    it("removes the nickname from phrasing other than Lembre a", () => {
        const stripped = stripContactTarget(
            "Avisa a Isabela amanhã de passear com o cachorro",
            "Isabela",
        );
        expect(stripped.toLowerCase()).not.toContain("isabela");
        expect(stripped.toLowerCase()).toContain("passear");
        expect(stripped.toLowerCase()).toContain("avisa");
    });
});
