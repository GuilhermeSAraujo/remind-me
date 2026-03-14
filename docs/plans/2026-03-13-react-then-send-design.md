# React First, Then Send — Design

**Date:** 2026-03-13

**Goal:** Swap the order of operations so the bot reacts to the user's message first, then sends the reply. WhatsApp's message preview shows the last activity; reacting first makes the preview show the emoji reaction (e.g. ✅) instead of the bot's message text, which is a better UX.

## Scope

- Apply **react then send** everywhere we currently do send then react.
- Add the missing reaction on the delay success path (AI-extract success).
- No new helpers or APIs (inline swap at each call site).

## Out of scope

- `server.ts`: already reacts ⏳ first on every message — no change.
- `schedule.ts`: already reacts ✅ then `sendReply` for reminder creation — no change.

## Design

### 1. message-processor.ts

For every branch that currently does send (or domain call that sends) then react, swap to **react then send / then domain call**:

| Branch              | Reaction | New order                                      |
|---------------------|----------|------------------------------------------------|
| Message too long    | 🚫       | react then sendMessage                         |
| Rate limit (classify)| 🚫      | react then sendMessage                         |
| Free user limit     | 😢       | react then sendMessage                         |
| Rate limit (extract)| 🚫       | react then sendMessage                         |
| list_reminders      | 📋       | react then listReminders                       |
| delete_reminder     | 🗑️       | react then deleteReminder                      |
| delay_reminder      | ✅       | react then delayReminder                       |
| buy_premium         | ⭐       | react then sendMessage                         |
| thank               | 😊       | react then sendMessage                         |
| help / default      | ℹ️       | react then sendMessages                        |

### 2. delay.ts

In every path that sends then reacts, do **react then send**. Add the missing reaction on the AI-extract success path:

| Path                 | Reaction | New order                          |
|----------------------|----------|------------------------------------|
| Reminder not found   | 🚫       | react then sendMessage             |
| Add 5 minutes        | ✅       | react then sendMessage             |
| AI-extract success   | ✅       | add react, then existing sendMessage |
| AI-extract error     | 🚫       | react then sendMessage             |

### 3. Error handling

No new logic. We still await react then send. If react fails, existing logging applies; we do not block sending.

### 4. Tests

- **message-processor:** No existing unit tests for the processor; no test file changes.
- **delay:** If any test asserts call order of sendMessage and reactMessage, update to expect react before send.
- **schedule:** No change (already correct order).

## Approach chosen

**Approach 1 — Inline swap:** Change each call site to call `reactMessage(...)` first, then perform the send or domain call. No helper; minimal and explicit.
