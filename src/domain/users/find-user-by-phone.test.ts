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
            phoneNumber: { $in: ["5531999999999", "5531999999999@s.whatsapp.net"] },
        });
        expect(user?.phoneNumber).toBe("5531999999999@s.whatsapp.net");
    });
});
