import { CONFIG, getSessionToken } from "./client";

const phoneCache = new Map<string, string>();

const LID_MIN_LENGTH = 14;

export function isLidNumber(phone: string): boolean {
  return phone.length >= LID_MIN_LENGTH;
}

/**
 * Resolves a LID to a real phone number via the wppconnect-server pn-lid API.
 * Returns the phone as-is if it's already a real number (< 14 digits).
 * Results are cached in-memory to avoid repeated API calls.
 */
export async function resolvePhoneNumber(phone: string): Promise<string> {
  if (!isLidNumber(phone)) {
    return phone;
  }

  const cached = phoneCache.get(phone);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/contact/pn-lid/${phone}@lid`,
      {
        headers: {
          accept: "*/*",
          Authorization: `Bearer ${await getSessionToken()}`,
        },
      },
    );

    if (!response.ok) {
      console.warn(`[RESOLVE PHONE] API returned ${response.status} for LID ${phone}`);
      return phone;
    }

    const data = (await response.json()) as Record<string, any>;

    const realPhone: string | undefined =
      data?.phoneNumber?.user ?? data?.phoneNumber?._serialized?.split("@")[0];

    if (realPhone && !isLidNumber(realPhone)) {
      phoneCache.set(phone, realPhone);
      console.info(`[RESOLVE PHONE] ${phone} → ${realPhone}`);
      return realPhone;
    }

    console.warn("[RESOLVE PHONE] Could not extract real phone from response:", JSON.stringify(data));
    return phone;
  } catch (error) {
    console.error("[RESOLVE PHONE] Error:", error);
    return phone;
  }
}
