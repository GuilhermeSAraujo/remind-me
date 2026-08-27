import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    mockSendMessage,
    mockFindAcceptedContactsForUser,
    mockContactFind,
} = vi.hoisted(() => ({
    mockSendMessage: vi.fn(),
    mockFindAcceptedContactsForUser: vi.fn(),
    mockContactFind: vi.fn(),
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
}));

vi.mock("./queries", () => ({
    findAcceptedContactsForUser: mockFindAcceptedContactsForUser,
}));

vi.mock("./contact.model", () => ({
    Contact: { find: mockContactFind },
}));

import { listContacts } from "./list";
import { CONTATOS_EMPTY_MESSAGE, contatosListMessage } from "./messages";

const isabela = {
    phoneNumber: "5531111111111",
    name: "Isabela",
    messageId: "wamid.1",
    messageKey: { remoteJid: "5531111111111@s.whatsapp.net", fromMe: false, id: "wamid.1" },
};

describe("listContacts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSendMessage.mockResolvedValue(true);
        mockFindAcceptedContactsForUser.mockResolvedValue([]);
        mockContactFind.mockResolvedValue([]);
    });

    it("sends empty guidance when no accepted and no pending sent invites", async () => {
        await listContacts({ userData: isabela });

        expect(mockFindAcceptedContactsForUser).toHaveBeenCalledWith(isabela.phoneNumber);
        expect(mockContactFind).toHaveBeenCalledWith({
            inviterPhoneNumber: "5531111111111",
            status: "pending",
        });
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: isabela.phoneNumber,
            message: CONTATOS_EMPTY_MESSAGE,
        });
    });

    it("lists accepted contacts and pending invites this user sent", async () => {
        mockFindAcceptedContactsForUser.mockResolvedValue([
            { nickname: "Victor", otherPhoneDigits: "5531999999999" },
        ]);
        mockContactFind.mockResolvedValue([
            {
                inviterNicknameForInvitee: "Ana",
                inviteePhoneNumber: "5531888888888",
                status: "pending",
            },
        ]);

        await listContacts({ userData: isabela });

        const acceptedLines = "• *Victor* — 5531999999999";
        const pendingLines = "• *Ana* — aguardando resposta";
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: isabela.phoneNumber,
            message: contatosListMessage(acceptedLines, pendingLines),
        });
    });

    it("lists only pending when there are no accepted contacts", async () => {
        mockContactFind.mockResolvedValue([
            {
                inviterNicknameForInvitee: "Victor",
                inviteePhoneNumber: "5531999999999",
                status: "pending",
            },
        ]);

        await listContacts({ userData: isabela });

        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: isabela.phoneNumber,
            message: contatosListMessage("", "• *Victor* — aguardando resposta"),
        });
    });
});
