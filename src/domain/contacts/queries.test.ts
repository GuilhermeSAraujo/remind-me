import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockFindOne, mockFind, mockSort } = vi.hoisted(() => {
    const mockSort = vi.fn();
    const mockFindOne = vi.fn(() => ({ sort: mockSort }));
    const mockFind = vi.fn();
    return { mockFindOne, mockFind, mockSort };
});

vi.mock("./contact.model", () => ({
    Contact: { findOne: mockFindOne, find: mockFind },
}));

import {
    findRelationship,
    findLatestPendingForInvitee,
    nicknameForOther,
    findAcceptedContactsForUser,
} from "./queries";

describe("contact queries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindOne.mockReturnValue({ sort: mockSort });
    });

    it("findRelationship looks up both directions with digits", async () => {
        mockFindOne.mockResolvedValueOnce({ inviterPhoneNumber: "5531111111111" });
        await findRelationship("5531111111111@s.whatsapp.net", "(31)99999-9999");
        expect(mockFindOne).toHaveBeenCalledWith({
            $or: [
                { inviterPhoneNumber: "5531111111111", inviteePhoneNumber: "5531999999999" },
                { inviterPhoneNumber: "5531999999999", inviteePhoneNumber: "5531111111111" },
            ],
        });
    });

    it("findLatestPendingForInvitee sorts pending by updatedAt desc", async () => {
        mockSort.mockResolvedValue({ inviteMessageId: "latest" });
        await findLatestPendingForInvitee("5531999999999@s.whatsapp.net");
        expect(mockFindOne).toHaveBeenCalledWith({
            inviteePhoneNumber: "5531999999999",
            status: "pending",
        });
        expect(mockSort).toHaveBeenCalledWith({ updatedAt: -1 });
    });

    it("nicknameForOther returns inviter nickname when viewer is invitee", async () => {
        mockFindOne.mockResolvedValueOnce({
            inviterPhoneNumber: "5531111111111",
            inviteePhoneNumber: "5531999999999",
            inviterNicknameForInvitee: "Victor",
            inviteeNicknameForInviter: "Isabela",
            status: "accepted",
        });
        await expect(nicknameForOther("5531999999999", "5531111111111")).resolves.toBe("Isabela");
    });

    it("findAcceptedContactsForUser maps nicknames for both roles", async () => {
        mockFind.mockResolvedValue([
            {
                inviterPhoneNumber: "5531111111111",
                inviteePhoneNumber: "5531999999999",
                inviterNicknameForInvitee: "Victor",
                inviteeNicknameForInviter: "Isabela",
                status: "accepted",
            },
        ]);
        const asInviter = await findAcceptedContactsForUser("5531111111111");
        expect(asInviter).toEqual([{ nickname: "Victor", otherPhoneDigits: "5531999999999" }]);
        const asInvitee = await findAcceptedContactsForUser("5531999999999");
        expect(asInvitee).toEqual([{ nickname: "Isabela", otherPhoneDigits: "5531111111111" }]);
    });
});
