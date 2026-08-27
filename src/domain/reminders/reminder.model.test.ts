import { describe, it, expect } from "vitest";
import { Reminder } from "./reminder.model";

describe("Reminder model – end condition fields", () => {
    it("has maxOccurrences defaulting to null", () => {
        const doc = new Reminder({
            userPhoneNumber: "5511999999999",
            title: "Test",
            scheduledTime: new Date(),
            messageId: "msg1",
        });
        expect(doc.maxOccurrences).toBeNull();
    });

    it("has endDate defaulting to null", () => {
        const doc = new Reminder({
            userPhoneNumber: "5511999999999",
            title: "Test",
            scheduledTime: new Date(),
            messageId: "msg1",
        });
        expect(doc.endDate).toBeNull();
    });

    it("has sentCount defaulting to 0", () => {
        const doc = new Reminder({
            userPhoneNumber: "5511999999999",
            title: "Test",
            scheduledTime: new Date(),
            messageId: "msg1",
        });
        expect(doc.sentCount).toBe(0);
    });

    it("accepts maxOccurrences as a number", () => {
        const doc = new Reminder({
            userPhoneNumber: "5511999999999",
            title: "Test",
            scheduledTime: new Date(),
            messageId: "msg1",
            maxOccurrences: 5,
        });
        expect(doc.maxOccurrences).toBe(5);
    });

    it("accepts endDate as a Date", () => {
        const end = new Date("2026-03-16T00:00:00");
        const doc = new Reminder({
            userPhoneNumber: "5511999999999",
            title: "Test",
            scheduledTime: new Date(),
            messageId: "msg1",
            endDate: end,
        });
        expect(doc.endDate).toEqual(end);
    });
});

describe("Reminder model – createdByPhoneNumber", () => {
    it("can be set on a new reminder", () => {
        const doc = new Reminder({
            userPhoneNumber: "5511999999999",
            createdByPhoneNumber: "5511888888888",
            title: "Test",
            scheduledTime: new Date(),
            messageId: "msg1",
        });
        expect(doc.createdByPhoneNumber).toBe("5511888888888");
    });

    it("stays undefined when missing (legacy rows)", () => {
        const doc = new Reminder({
            userPhoneNumber: "5511999999999",
            title: "Test",
            scheduledTime: new Date(),
            messageId: "msg1",
        });
        expect(doc.createdByPhoneNumber).toBeUndefined();
    });
});
