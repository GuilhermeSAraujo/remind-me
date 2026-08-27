import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockFindOne } = vi.hoisted(() => ({ mockFindOne: vi.fn() }));

vi.mock("./user.model", () => ({
    User: { findOne: mockFindOne },
}));

import { findUserByAnyPhone } from "./find-user-by-phone";

describe("findUserByAnyPhone", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("queries digit and JID variants", async () => {
        mockFindOne.mockResolvedValue({ phoneNumber: "5531999999999@s.whatsapp.net" });
        const user = await findUserByAnyPhone("5531999999999");
        expect(mockFindOne).toHaveBeenCalledWith({
            phoneNumber: {
                $in: expect.arrayContaining([
                    "5531999999999",
                    "5531999999999@s.whatsapp.net",
                ]),
            },
        });
        expect(user?.phoneNumber).toBe("5531999999999@s.whatsapp.net");
    });

    it("includes ninth-digit variants so 12-digit JIDs find 13-digit users", async () => {
        mockFindOne.mockResolvedValue({ phoneNumber: "5531998296801@s.whatsapp.net" });
        const user = await findUserByAnyPhone("553198296801");
        expect(mockFindOne).toHaveBeenCalledWith({
            phoneNumber: {
                $in: expect.arrayContaining([
                    "553198296801",
                    "553198296801@s.whatsapp.net",
                    "5531998296801",
                    "5531998296801@s.whatsapp.net",
                ]),
            },
        });
        expect(user?.phoneNumber).toBe("5531998296801@s.whatsapp.net");
    });
});
