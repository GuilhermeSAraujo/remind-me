import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    mockSendMessage,
    mockSendMessageGetId,
    mockCreate,
    mockFindRelationship,
    mockNicknameTaken,
} = vi.hoisted(() => ({
    mockSendMessage: vi.fn(),
    mockSendMessageGetId: vi.fn(),
    mockCreate: vi.fn(),
    mockFindRelationship: vi.fn(),
    mockNicknameTaken: vi.fn(),
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: mockSendMessage,
    sendMessageGetId: mockSendMessageGetId,
}));

vi.mock("./contact.model", () => ({
    Contact: { create: mockCreate },
}));

vi.mock("./queries", () => ({
    findRelationship: mockFindRelationship,
    nicknameTaken: mockNicknameTaken,
}));

import { parseRegisterContact, registerContact } from "./register";
import {
    CADASTRO_FORMAT_MESSAGE,
    CADASTRO_SELF_MESSAGE,
    cadastroAlreadyAcceptedMessage,
    cadastroAlreadyPendingMessage,
    cadastroDuplicateNicknameMessage,
    cadastroReversePendingMessage,
} from "./messages";

const isabela = {
    phoneNumber: "5531111111111",
    name: "Isabela",
    messageId: "wamid.1",
    messageKey: { remoteJid: "5531111111111@s.whatsapp.net", fromMe: false, id: "wamid.1" },
};

describe("parseRegisterContact", () => {
    it("parses phone and multi-word name", () => {
        expect(parseRegisterContact("Cadastrar pessoa (31)999999999 Victor Silva")).toEqual({
            rawPhone: "(31)999999999",
            name: "Victor Silva",
        });
    });

    it("returns null without a name", () => {
        expect(parseRegisterContact("Cadastrar pessoa (31)999999999")).toBeNull();
    });
});

describe("registerContact", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSendMessage.mockResolvedValue(true);
        mockFindRelationship.mockResolvedValue(null);
        mockNicknameTaken.mockResolvedValue(false);
        mockSendMessageGetId.mockResolvedValue("wamid.invite");
        mockCreate.mockResolvedValue({});
    });

    it("sends format help when parse fails", async () => {
        await registerContact({ userData: isabela, message: "cadastrar pessoa" });
        expect(mockSendMessage).toHaveBeenCalledWith({
            phone: isabela.phoneNumber,
            message: CADASTRO_FORMAT_MESSAGE,
        });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("refuses self-cadastro", async () => {
        await registerContact({
            userData: isabela,
            message: "Cadastrar pessoa 31111111111 Eu",
        });
        expect(mockSendMessage.mock.calls[0]![0].message).toBe(CADASTRO_SELF_MESSAGE);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("does not persist when WhatsApp send returns no id", async () => {
        mockSendMessageGetId.mockResolvedValue(null);
        await registerContact({
            userData: isabela,
            message: "Cadastrar pessoa (31)999999999 Victor",
        });
        expect(mockCreate).not.toHaveBeenCalled();
        expect(mockSendMessage.mock.calls[0]![0].message).toContain("Não consegui entregar o convite");
    });

    it("creates pending contact and confirms after invite send", async () => {
        await registerContact({
            userData: isabela,
            message: "Cadastrar pessoa (31)999999999 Victor",
        });
        expect(mockSendMessageGetId).toHaveBeenCalledWith(
            expect.objectContaining({ phone: "5531999999999" }),
        );
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                inviterPhoneNumber: "5531111111111",
                inviteePhoneNumber: "5531999999999",
                inviterNicknameForInvitee: "Victor",
                status: "pending",
                inviteMessageId: "wamid.invite",
            }),
        );
        expect(mockSendMessage.mock.calls[0]![0].message).toContain("Convite enviado para Victor");
    });

    it("reports already pending when viewer is inviter", async () => {
        mockFindRelationship.mockResolvedValue({
            inviterPhoneNumber: "5531111111111",
            inviteePhoneNumber: "5531999999999",
            inviterNicknameForInvitee: "Victor",
            status: "pending",
        });
        await registerContact({
            userData: isabela,
            message: "Cadastrar pessoa (31)999999999 Victor",
        });
        expect(mockSendMessage.mock.calls[0]![0].message).toBe(
            cadastroAlreadyPendingMessage("Victor"),
        );
        expect(mockSendMessageGetId).not.toHaveBeenCalled();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("reports reverse pending when viewer is invitee", async () => {
        mockFindRelationship.mockResolvedValue({
            inviterPhoneNumber: "5531999999999",
            inviteePhoneNumber: "5531111111111",
            inviterNicknameForInvitee: "Isabela",
            status: "pending",
        });
        await registerContact({
            userData: isabela,
            message: "Cadastrar pessoa (31)999999999 Victor",
        });
        expect(mockSendMessage.mock.calls[0]![0].message).toBe(cadastroReversePendingMessage());
        expect(mockSendMessageGetId).not.toHaveBeenCalled();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("reports already accepted using stored nickname", async () => {
        mockFindRelationship.mockResolvedValue({
            inviterPhoneNumber: "5531111111111",
            inviteePhoneNumber: "5531999999999",
            inviterNicknameForInvitee: "Vitin",
            inviteeNicknameForInviter: "Bela",
            status: "accepted",
        });
        await registerContact({
            userData: isabela,
            message: "Cadastrar pessoa (31)999999999 Victor",
        });
        expect(mockSendMessage.mock.calls[0]![0].message).toBe(
            cadastroAlreadyAcceptedMessage("Vitin"),
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("rejects duplicate nickname", async () => {
        mockNicknameTaken.mockResolvedValue(true);
        await registerContact({
            userData: isabela,
            message: "Cadastrar pessoa (31)999999999 Victor",
        });
        expect(mockNicknameTaken).toHaveBeenCalledWith(
            "5531111111111",
            "Victor",
            "5531999999999",
        );
        expect(mockSendMessage.mock.calls[0]![0].message).toBe(
            cadastroDuplicateNicknameMessage("Victor"),
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("reopens rejected contact via save instead of create", async () => {
        const mockSave = vi.fn().mockResolvedValue({});
        const rejected = {
            inviterPhoneNumber: "5531111111111",
            inviteePhoneNumber: "5531999999999",
            inviterNicknameForInvitee: "Old",
            inviteeNicknameForInviter: null,
            status: "rejected",
            inviteMessageId: "wamid.old",
            save: mockSave,
        };
        mockFindRelationship.mockResolvedValue(rejected);
        await registerContact({
            userData: isabela,
            message: "Cadastrar pessoa (31)999999999 Victor",
        });
        expect(mockCreate).not.toHaveBeenCalled();
        expect(rejected.status).toBe("pending");
        expect(rejected.inviterNicknameForInvitee).toBe("Victor");
        expect(rejected.inviteMessageId).toBe("wamid.invite");
        expect(mockSave).toHaveBeenCalled();
        expect(mockSendMessage.mock.calls[0]![0].message).toContain("Convite enviado para Victor");
    });
});
