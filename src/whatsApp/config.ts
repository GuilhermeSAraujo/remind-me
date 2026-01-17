import { env } from "../env.js";

export const CONFIG = {
  API_BASE_URL: "http://localhost:21465",
  SESSION_NAME: "remind-me-auto",
} as const;

let SESSION_TOKEN = "";

export async function getSessionToken() {

  if (!SESSION_TOKEN) {
    await startSession();
  }

  return SESSION_TOKEN;
}

export async function startSession() {
  // generate token
  const tokenResponse = await fetch(`${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/${env.SECRET_KEY}/generate-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const tokenData = await tokenResponse.json() as { token: string }

  SESSION_TOKEN = tokenData.token;

  console.log("[CONFIG] Session token:", !!SESSION_TOKEN);

  const response = await fetch(`${CONFIG.API_BASE_URL}/api/${env.SECRET_KEY}/show-all-sessions`)

  const existingSessions = await response.json() as { response: string[] }

  console.log('[CONFIG] Existing sessions:', existingSessions.response);

  if (!existingSessions.response.includes(CONFIG.SESSION_NAME)) {
    console.log("[CONFIG] Creating brand new session");
    await fetch(`${CONFIG.API_BASE_URL}/api/${CONFIG.SESSION_NAME}/start-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SESSION_TOKEN}`,
      },
    });

    return;
  }

}