import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { CONFIG, getSessionToken } from "./client";
import { env } from "../../config/env";

export interface SendImageOptions {
    phone: string;
    filename: string;
    caption?: string;
    isGroup?: boolean;
    isNewsletter?: boolean;
    isLid?: boolean;
}

/**
 * Gets the MIME type based on file extension
 */
function getMimeType(imagePath: string): string {
    const lowerPath = imagePath.toLowerCase();

    if (lowerPath.endsWith(".png")) return "image/png";
    if (lowerPath.endsWith(".gif")) return "image/gif";
    if (lowerPath.endsWith(".webp")) return "image/webp";

    return "image/jpeg"; // Default for .jpg and .jpeg
}

/**
 * Sends an image via WhatsApp API
 * @param options - Image sending options
 * @param imagePath - Path to the image file relative to the assets folder
 * @returns Promise<boolean> - True if image was sent successfully
 */
export async function sendImage(options: SendImageOptions, imagePath: string): Promise<boolean> {
    let {
        phone,
        filename,
        caption = "",
        isGroup = false,
        isNewsletter = false,
        isLid = true,
    } = options;

    if (phone.length === 13) {
        isLid = false;
    }

    try {
        // Em produção (bundled), process.cwd() aponta para /app e assets está em /app/dist/assets
        const assetsPath = join(process.cwd(), "dist/assets", imagePath);

        if (!existsSync(assetsPath)) {
            console.error("[SEND IMAGE] 🚨 File not found:", assetsPath);
            return false;
        }

        // Read image and convert to base64 with data URI prefix
        const imageBuffer = readFileSync(assetsPath);
        const mimeType = getMimeType(imagePath);
        const base64Image = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

        const response = await fetch(`${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/send-image`, {
            method: "POST",
            headers: {
                accept: "*/*",
                Authorization: `Bearer ${await getSessionToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                phone: env.LOCAL_TEST_MODE ? env.LOCAL_TEST_GROUP_ID : phone,
                isGroup,
                isNewsletter,
                isLid,
                filename,
                caption,
                base64: base64Image,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error("[SEND IMAGE] 🚨 API ERROR:", response.status, text);
            return false;
        }

        return true;
    } catch (error) {
        console.error("[SEND IMAGE] 🚨 Unexpected ERROR:", error);
        return false;
    }
}
