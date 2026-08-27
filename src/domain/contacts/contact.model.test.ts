import { describe, expect, it } from "vitest";
import { Contact } from "./contact.model";

describe("Contact model", () => {
    it("defaults status to pending and reverse nickname to null", () => {
        const doc = new Contact({
            inviterPhoneNumber: "5531111111111",
            inviteePhoneNumber: "5531999999999",
            inviterNicknameForInvitee: "Victor",
            inviteMessageId: "wamid.invite",
        });
        expect(doc.status).toBe("pending");
        expect(doc.inviteeNicknameForInviter).toBeNull();
    });
});
