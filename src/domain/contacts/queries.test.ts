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
    findPendingByInviteMessageId,
    nicknameForOther,
    findAcceptedContactsForUser,
} from "./queries";

describe("contact queries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindOne.mockReset();
        mockFind.mockReset();
        mockSort.mockReset();
        mockFindOne.mockReturnValue({ sort: mockSort });
    });

    it("findRelationship looks up both directions with digits", async () => {
        mockFindOne.mockResolvedValueOnce({ inviterPhoneNumber: "5531111111111" });
        await findRelationship("5531111111111@s.whatsapp.net", "(31)99999-9999");
        expect(mockFindOne).toHaveBeenCalledWith({
            $or: [
                {
                    inviterPhoneNumber: { $in: expect.arrayContaining(["5531111111111"]) },
                    inviteePhoneNumber: { $in: expect.arrayContaining(["5531999999999"]) },
                },
                {
                    inviterPhoneNumber: { $in: expect.arrayContaining(["5531999999999"]) },
                    inviteePhoneNumber: { $in: expect.arrayContaining(["5531111111111"]) },
                },
            ],
        });
    });

    it("findLatestPendingForInvitee sorts pending by updatedAt desc", async () => {
        mockSort.mockResolvedValue({ inviteMessageId: "latest" });
        await findLatestPendingForInvitee("5531999999999@s.whatsapp.net");
        expect(mockFindOne).toHaveBeenCalledWith({
            inviteePhoneNumber: { $in: expect.arrayContaining(["5531999999999"]) },
            status: "pending",
        });
        expect(mockSort).toHaveBeenCalledWith({ updatedAt: -1 });
    });

    it("findLatestPendingForInvitee matches ninth-digit WhatsApp JIDs", async () => {
        mockSort.mockResolvedValue({ inviteMessageId: "latest" });
        await findLatestPendingForInvitee("553198296801@s.whatsapp.net");
        expect(mockFindOne).toHaveBeenCalledWith({
            inviteePhoneNumber: {
                $in: expect.arrayContaining(["553198296801", "5531998296801"]),
            },
            status: "pending",
        });
    });

    it("findPendingByInviteMessageId falls back to id-only when phone misses", async () => {
        const contact = { inviteMessageId: "wamid.invite", status: "pending" };
        mockFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(contact);

        await expect(
            findPendingByInviteMessageId("140393070978714@lid", "wamid.invite"),
        ).resolves.toBe(contact);

        expect(mockFindOne).toHaveBeenNthCalledWith(1, {
            inviteMessageId: "wamid.invite",
            status: "pending",
            inviteePhoneNumber: { $in: expect.any(Array) },
        });
        expect(mockFindOne).toHaveBeenNthCalledWith(2, {
            inviteMessageId: "wamid.invite",
            status: "pending",
        });
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
