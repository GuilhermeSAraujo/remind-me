import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockFind } = vi.hoisted(() => ({ mockFind: vi.fn() }));

vi.mock("./user.model", () => ({
    User: { find: mockFind },
}));

import { findUserByAnyPhone } from "./find-user-by-phone";

describe("findUserByAnyPhone", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("queries digit and JID variants", async () => {
        mockFind.mockResolvedValue([{ phoneNumber: "5531999999999@s.whatsapp.net" }]);
        const user = await findUserByAnyPhone("5531999999999");
        expect(mockFind).toHaveBeenCalledWith({
            phoneNumber: {
                $in: expect.arrayContaining([
                    "5531999999999",
                    "5531999999999@s.whatsapp.net",
                ]),
            },
        });
        expect(user?.phoneNumber).toBe("5531999999999@s.whatsapp.net");
    });

    it("returns the bare-digit user when a JID duplicate also matches", async () => {
        const digits = { phoneNumber: "5531999999999" };
        const jid = { phoneNumber: "5531999999999@s.whatsapp.net" };
        mockFind.mockResolvedValue([jid, digits]);

        const user = await findUserByAnyPhone("5531999999999@s.whatsapp.net");

        expect(user).toBe(digits);
    });

    it("includes ninth-digit variants so 12-digit JIDs find 13-digit users", async () => {
        mockFind.mockResolvedValue([{ phoneNumber: "5531998296801@s.whatsapp.net" }]);
        const user = await findUserByAnyPhone("553198296801");
        expect(mockFind).toHaveBeenCalledWith({
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
