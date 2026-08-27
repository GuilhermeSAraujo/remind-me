import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
    env: { AUTHENTICATION_API_KEY: "test-key" },
}));

vi.mock("./client", () => ({
    CONFIG: { API_BASE_URL: "http://evolution.test", SESSION_NAME: "remind-bot" },
}));

import { sendMessageGetId } from "./send-message";

const options = { phone: "5531999999999", message: "olá" };

describe("sendMessageGetId", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", mockFetch);
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function jsonResponse(body: unknown, ok = true) {
        mockFetch.mockResolvedValue({
            ok,
            json: async () => body,
        });
    }

    it("returns key.id", async () => {
        jsonResponse({ key: { id: "wamid.key" } });
        await expect(sendMessageGetId(options)).resolves.toBe("wamid.key");
    });

    it("returns data.key.id", async () => {
        jsonResponse({ data: { key: { id: "wamid.nested" } } });
        await expect(sendMessageGetId(options)).resolves.toBe("wamid.nested");
    });

    it("returns keyId", async () => {
        jsonResponse({ keyId: "wamid.flat" });
        await expect(sendMessageGetId(options)).resolves.toBe("wamid.flat");
    });

    it("returns null when response is not ok", async () => {
        jsonResponse({ key: { id: "wamid.key" } }, false);
        await expect(sendMessageGetId(options)).resolves.toBeNull();
    });

    it("returns null when the body is not JSON", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => {
                throw new SyntaxError("Unexpected token");
            },
        });
        await expect(sendMessageGetId(options)).resolves.toBeNull();
    });
});
