import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockSendMessage, mockFindUserByAnyPhone } = vi.hoisted(() => ({
    mockSendMessage: vi.fn(),
    mockFindUserByAnyPhone: vi.fn(),
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
}));

vi.mock("../users/find-user-by-phone", () => ({
    findUserByAnyPhone: mockFindUserByAnyPhone,
}));

import {
    classifyInviteText,
    classifyInviteReaction,
    applyInviteDecision,
} from "./invite-response";
import {
    inviteAcceptedInviteeMessage,
    inviteAcceptedInviterMessage,
    inviteRejectedInviteeMessage,
    inviteRejectedInviterMessage,
    inviteUnknownReactionMessage,
} from "./messages";
import type { IContact } from "./contact.model";

const invitee = {
    phoneNumber: "5531999999999",
    name: "Victor",
    messageId: "wamid.reply",
    messageKey: {
        remoteJid: "5531999999999@s.whatsapp.net",
        fromMe: false,
        id: "wamid.reply",
    },
};

function stubContact(overrides: Partial<IContact> = {}): IContact {
    return {
        inviterPhoneNumber: "5531111111111",
        inviteePhoneNumber: "5531999999999",
        inviterNicknameForInvitee: "Victor",
        inviteeNicknameForInviter: null,
        status: "pending",
        inviteMessageId: "wamid.invite",
        save: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    } as unknown as IContact;
}

describe("classifyInviteText", () => {
    it("accepts short yes/no only", () => {
        expect(classifyInviteText("sim")).toBe("yes");
        expect(classifyInviteText("nao")).toBe("no");
        expect(classifyInviteText("não")).toBe("no");
        expect(classifyInviteText("Me lembre de comprar pão")).toBeNull();
        expect(classifyInviteText("sim, me lembre de x")).toBeNull();
    });
});

describe("classifyInviteReaction", () => {
    it("maps known emojis", () => {
        expect(classifyInviteReaction("👍")).toBe("yes");
        expect(classifyInviteReaction("👎")).toBe("no");
        expect(classifyInviteReaction("😂")).toBe("unknown");
    });
});

describe("applyInviteDecision", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSendMessage.mockResolvedValue(true);
        mockFindUserByAnyPhone.mockResolvedValue({
            phoneNumber: "5531111111111@s.whatsapp.net",
            name: "Isabela",
        });
    });

    it("accepts: sets nickname from inviter name and messages both", async () => {
        const contact = stubContact();
        await applyInviteDecision({
            userData: invitee,
            contact,
            decision: "yes",
        });

        expect(contact.status).toBe("accepted");
        expect(contact.inviteeNicknameForInviter).toBe("Isabela");
        expect(contact.save).toHaveBeenCalledOnce();
        expect(mockSendMessage).toHaveBeenCalledTimes(2);
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: invitee.phoneNumber,
            message: inviteAcceptedInviteeMessage("Isabela"),
        });
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: "5531111111111@s.whatsapp.net",
            message: inviteAcceptedInviterMessage("Victor"),
        });
    });

    it("unknown: messages invitee only with guidance", async () => {
        const contact = stubContact();
        await applyInviteDecision({
            userData: invitee,
            contact,
            decision: "unknown",
        });

        expect(contact.status).toBe("pending");
        expect(contact.save).not.toHaveBeenCalled();
        expect(mockFindUserByAnyPhone).not.toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        expect(mockSendMessage.mock.calls[0]![0].message).toContain(
            "Não entendi essa reação",
        );
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: invitee.phoneNumber,
            message: inviteUnknownReactionMessage(),
        });
    });

    it("rejects: messages both parties", async () => {
        const contact = stubContact();
        await applyInviteDecision({
            userData: invitee,
            contact,
            decision: "no",
        });

        expect(contact.status).toBe("rejected");
        expect(contact.save).toHaveBeenCalledOnce();
        expect(mockSendMessage).toHaveBeenCalledTimes(2);
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: invitee.phoneNumber,
            message: inviteRejectedInviteeMessage("Isabela"),
        });
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: "5531111111111@s.whatsapp.net",
            message: inviteRejectedInviterMessage("Victor"),
        });
    });
});
