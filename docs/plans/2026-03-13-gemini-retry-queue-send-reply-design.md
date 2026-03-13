# Design: Gemini retry queue + send-reply (reminder flow)

**Date:** 2026-03-13

## Summary

- Add an **in-memory parallel queue** (p-queue) so only **scheduleReminder** is enqueued; the main request thread returns immediately.
- **Retry** on transient Gemini errors (503, 429, 408, 500, 502, 504) with **exponential backoff** inside the Gemini client; optional **onRetry** callback to notify the user once (“error occurred, reminder will be processed as soon as the AI is back”).
- **Fix send-reply** and use it **only in schedule.ts** for (1) success confirmation after creating reminders and (2) the “AI is back” retry message. Everywhere else keeps **sendMessage** (including send-messages per item).

---

## 1. Architecture and request flow

- **Incoming reminder message** → handler does cheap checks (rate limit, intent), then for reminder intent **enqueues** a job that runs `scheduleReminder({ userData, message, messageId })` and returns (main request thread freed).
- **Queue worker** runs the job: runs `scheduleReminder` → `extractReminderData` → `generateContentWithContext` (with retry + onRetry inside the client).
- **Retries** happen inside the client; when the callback is provided, it sends the user-facing “AI is back” message via **sendReply** once on first retry.

**Scope:** Enqueue only the reminder flow for now. Classify and delay keep current behaviour (no queue, no onRetry).

---

## 2. Queue and retry

**Reminder job queue (p-queue v9.x)**

- Single global p-queue. Tasks: async fn that runs `scheduleReminder(...)`.
- Concurrency: configurable (e.g. 5).
- Message-processor: `reminderQueue.add(() => scheduleReminder(...))` then return (fire-and-forget).

**Retry in Gemini client**

- No inner queue. `generateContentWithContext` wraps the real call in a retry loop.
- **Transient:** status in { 408, 429, 500, 502, 503, 504 }.
- **Backoff:** exponential (e.g. base 2s, multiplier 2, max 3 retries).
- **onRetry:** optional `(attempt: number) => void | Promise<void>`, called once before first retry. Reminder flow passes a callback that does `sendReply(phone, messageId, MESSAGE_AI_BACK_SOON)`.

---

## 3. send-reply fix and usage

**Fix**

- New signature: `sendReply(options: { phone: string; messageId: string; message: string; isGroup?: boolean })`.
- Use `resolvePhoneNumber(options.phone)` and same LOCAL_TEST_MODE / LOCAL_TEST_GROUP_ID behaviour as send-message. Body: `phone`, `isGroup`, `message`, `messageId` (wppconnect-server contract). Remove any use of PRODUCTION_GROUP_ID.

**Use sendReply only in schedule.ts**

- Success confirmation after creating reminders (lines 67–70): `sendReply({ phone: userData.phoneNumber, messageId: userData.messageId, message: successMessage })`.
- “AI is back” message in onRetry callback: same, with the fixed copy.

**Everywhere else**

- Keep **sendMessage** (message-processor, list, delete, delay, reminder-trigger, premium watcher). Keep **sendMessage** per item in send-messages.

---

## 4. Error handling and testing

- After max retries, the error propagates; scheduleReminder will throw and the queue task will reject. Log and optionally increment a failure metric; no need to notify the user again (they already got the “AI is back” message on first retry).
- Tests: mock the queue (add returns a promise we can await in tests if needed). Mock sendReply in schedule tests where we now use it instead of sendMessage for the success path. Gemini client tests: assert retry count and onRetry invocation on transient error.

---

## 5. Implementation plan

Next step: invoke writing-plans skill to produce a detailed implementation plan (tasks, file changes, order of work).
