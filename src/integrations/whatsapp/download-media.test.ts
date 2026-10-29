import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
    env: { AUTHENTICATION_API_KEY: "test-key" },
}));

vi.mock("./client", () => ({
    CONFIG: { API_BASE_URL: "http://evolution.test", SESSION_NAME: "remind-bot" },
}));

import { downloadAudio } from "./download-media";

describe("downloadAudio", () => {
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

    it("downloads base64 and strips codec parameters from the mime type", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                base64: "data:audio/ogg;base64,AAAA",
                mimetype: "audio/ogg; codecs=opus",
            }),
        });

        await expect(downloadAudio("wamid.audio")).resolves.toEqual({
            base64: "AAAA",
            mimeType: "audio/ogg",
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "http://evolution.test/chat/getBase64FromMediaMessage/remind-bot",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({ apikey: "test-key" }),
                body: JSON.stringify({
                    message: { key: { id: "wamid.audio" } },
                    convertToMp4: false,
                }),
            }),
        );
    });

    it("returns null when Evolution rejects the download", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            text: async () => "missing",
        });

        await expect(downloadAudio("wamid.audio")).resolves.toBeNull();
    });
});
