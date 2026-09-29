import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFind, mockFindOne, mockCreate } = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockFindOne: vi.fn(),
    mockCreate: vi.fn(),
}));

vi.mock("./user.model", () => ({
    User: { find: mockFind, findOne: mockFindOne, create: mockCreate },
}));

vi.mock("../../integrations/whatsapp/send-message", () => ({
    sendMessage: vi.fn().mockResolvedValue(true),
}));

import { UserService } from "./user.service";

describe("UserService.findOrCreateUser", () => {
    const service = new UserService();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("finds an existing user by digit and JID variants", async () => {
        mockFind.mockResolvedValueOnce([
            {
                phoneNumber: "553198296801@s.whatsapp.net",
                name: "Victor",
            },
        ]);

        const user = await service.findOrCreateUser(
            "553198296801@s.whatsapp.net",
            "Victor",
        );

        expect(mockCreate).not.toHaveBeenCalled();
        expect(mockFind).toHaveBeenCalledWith({
            phoneNumber: {
                $in: expect.arrayContaining([
                    "553198296801",
                    "553198296801@s.whatsapp.net",
                ]),
            },
        });
        expect(user.phoneNumber).toBe("553198296801@s.whatsapp.net");
    });

    it("returns the bare-digit user when a JID duplicate also matches", async () => {
        const digits = { phoneNumber: "553198296801", name: "Victor" };
        const jid = { phoneNumber: "553198296801@s.whatsapp.net", name: "Lembretes" };
        mockFind.mockResolvedValueOnce([jid, digits]);

        const user = await service.findOrCreateUser(
            "553198296801@s.whatsapp.net",
            "Victor",
        );

        expect(user).toBe(digits);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("migrates a LID user to the resolved phone number", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        mockFind.mockResolvedValueOnce([]);
        mockFindOne.mockResolvedValueOnce({
            phoneNumber: "140393070978714@lid",
            name: "Victor",
            save,
        });

        const user = await service.findOrCreateUser(
            "553198296801@s.whatsapp.net",
            "Victor",
            "140393070978714@lid",
        );

        expect(user.phoneNumber).toBe("553198296801@s.whatsapp.net");
        expect(save).toHaveBeenCalledOnce();
        expect(mockCreate).not.toHaveBeenCalled();
    });
});
