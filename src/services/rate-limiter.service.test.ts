import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOne } = vi.hoisted(() => ({
    mockFindOne: vi.fn(),
}));

vi.mock("../domain/users/user.model", () => ({
    User: { findOne: mockFindOne },
}));

import { checkReminderCreationLimit, recordReminderCreation } from "./rate-limiter.service";

function freeUser(reminderCreations: Date[]) {
    return {
        phoneNumber: "5531999999999",
        isPremium: false as boolean,
        premiumExpiresAt: undefined as Date | undefined,
        reminderCreations,
        save: vi.fn().mockResolvedValue(undefined),
    };
}

describe("reminder creation quota", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("allows a free user with no creations and reports 3 remaining", async () => {
        mockFindOne.mockResolvedValue(freeUser([]));

        const limit = await checkReminderCreationLimit("5531999999999");

        expect(limit.allowed).toBe(true);
        expect(limit.remaining).toBe(3);
        expect(limit.isPremium).toBe(false);
    });

    it("allows a free user under the cap", async () => {
        mockFindOne.mockResolvedValue(freeUser([new Date(), new Date()]));

        const limit = await checkReminderCreationLimit("5531999999999");

        expect(limit.allowed).toBe(true);
        expect(limit.remaining).toBe(1);
    });

    it("blocks a free user with 3 creations in the window", async () => {
        mockFindOne.mockResolvedValue(freeUser([new Date(), new Date(), new Date()]));

        const limit = await checkReminderCreationLimit("5531999999999");

        expect(limit.allowed).toBe(false);
        expect(limit.remaining).toBe(0);
        expect(limit.resetIn).toBeGreaterThan(0);
        expect(limit.resetIn).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it("ignores creations older than 24 hours", async () => {
        const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
        mockFindOne.mockResolvedValue(freeUser([stale, stale, stale]));

        const limit = await checkReminderCreationLimit("5531999999999");

        expect(limit.allowed).toBe(true);
        expect(limit.remaining).toBe(3);
    });

    it("treats a missing creation list as empty", async () => {
        const user = freeUser([]);
        delete (user as { reminderCreations?: Date[] }).reminderCreations;
        mockFindOne.mockResolvedValue(user);

        const limit = await checkReminderCreationLimit("5531999999999");

        expect(limit.allowed).toBe(true);
        expect(limit.remaining).toBe(3);
    });

    it("does not limit an active premium user", async () => {
        const user = freeUser([new Date(), new Date(), new Date()]);
        user.isPremium = true;
        user.premiumExpiresAt = new Date(Date.now() + 60_000);
        mockFindOne.mockResolvedValue(user);

        const limit = await checkReminderCreationLimit("5531999999999");

        expect(limit.allowed).toBe(true);
        expect(limit.remaining).toBe(-1);
        expect(limit.isPremium).toBe(true);
        expect(limit.resetIn).toBe(0);
    });

    it("limits a premium user whose subscription has expired", async () => {
        const user = freeUser([new Date(), new Date(), new Date()]);
        user.isPremium = true;
        user.premiumExpiresAt = new Date(Date.now() - 1000);
        mockFindOne.mockResolvedValue(user);

        const limit = await checkReminderCreationLimit("5531999999999");

        expect(limit.allowed).toBe(false);
        expect(limit.isPremium).toBe(false);
    });

    it("throws when the user does not exist", async () => {
        mockFindOne.mockResolvedValue(null);

        await expect(checkReminderCreationLimit("5531999999999")).rejects.toThrow("User not found");
    });

    it("appends a timestamp and drops entries older than 25 hours", async () => {
        const recent = new Date();
        const stale = new Date(Date.now() - 26 * 60 * 60 * 1000);
        const user = freeUser([stale, recent]);
        mockFindOne.mockResolvedValue(user);

        await recordReminderCreation("5531999999999");

        expect(user.reminderCreations).toHaveLength(2);
        expect(user.reminderCreations).not.toContain(stale);
        expect(user.reminderCreations[0]).toBe(recent);
        expect(user.save).toHaveBeenCalledOnce();
    });

    it("does not record a creation for an active premium user", async () => {
        const user = freeUser([new Date()]);
        user.isPremium = true;
        user.premiumExpiresAt = new Date(Date.now() + 60_000);
        mockFindOne.mockResolvedValue(user);

        await recordReminderCreation("5531999999999");

        expect(user.reminderCreations).toHaveLength(1);
        expect(user.save).not.toHaveBeenCalled();
    });
});
