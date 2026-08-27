import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOne, mockCreate } = vi.hoisted(() => ({
    mockFindOne: vi.fn(),
    mockCreate: vi.fn(),
}));

vi.mock("./user.model", () => ({
    User: { findOne: mockFindOne, create: mockCreate },
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
        mockFindOne.mockResolvedValueOnce({
            phoneNumber: "553198296801@s.whatsapp.net",
            name: "Victor",
        });

        const user = await service.findOrCreateUser(
            "553198296801@s.whatsapp.net",
            "Victor",
        );

        expect(mockCreate).not.toHaveBeenCalled();
        expect(mockFindOne).toHaveBeenCalledWith({
            phoneNumber: {
                $in: expect.arrayContaining([
                    "553198296801",
                    "553198296801@s.whatsapp.net",
                ]),
            },
        });
        expect(user.phoneNumber).toBe("553198296801@s.whatsapp.net");
    });

    it("migrates a LID user to the resolved phone number", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        mockFindOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
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
