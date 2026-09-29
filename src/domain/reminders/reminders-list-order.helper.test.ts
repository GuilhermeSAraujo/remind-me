import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFind, mockSort } = vi.hoisted(() => {
    const mockSort = vi.fn().mockResolvedValue([]);
    const mockFind = vi.fn().mockReturnValue({ sort: mockSort });
    return { mockFind, mockSort };
});

vi.mock("./reminder.model", () => ({
    Reminder: { find: mockFind },
}));

import {
    getRemindersCreatedForOthers,
    getRemindersInListOrder,
} from "./reminders-list-order.helper";

const digits = "5511999999999";
const jid = `${digits}@s.whatsapp.net`;

describe("reminder list queries match phone variants", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFind.mockReturnValue({ sort: mockSort });
        mockSort.mockResolvedValue([]);
    });

    it("lists pending reminders stored as digits or a WhatsApp JID", async () => {
        await getRemindersInListOrder(digits);

        expect(mockFind).toHaveBeenCalledWith({
            userPhoneNumber: { $in: expect.arrayContaining([digits, jid]) },
            status: "pending",
        });
        expect(mockSort).toHaveBeenCalledWith({ scheduledTime: 1 });
    });

    it("does not treat a JID self-reminder as created for someone else", async () => {
        await getRemindersCreatedForOthers(digits);

        expect(mockFind).toHaveBeenCalledWith({
            createdByPhoneNumber: { $in: expect.arrayContaining([digits, jid]) },
            userPhoneNumber: { $nin: expect.arrayContaining([digits, jid]) },
            status: "pending",
        });
    });
});
