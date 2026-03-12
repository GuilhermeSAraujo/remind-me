# Multi-Prompt Reminder Extraction — Design

**Date:** 2026-03-12  
**Status:** Approved

## Problem

The current single-prompt `PROMPT_EXTRACT_REMINDER_DATA` extracts all reminder fields (title, date, recurrence) in one call. This leads to frequent misidentification of `recurrence_type`, most often defaulting to `daily` or similar when the user did not express any recurrence.

## Goal

Break reminder extraction into two focused, sequential prompts per reminder. Keep the existing single-prompt path working, gated behind a global feature flag.

---

## Feature Flag

Controlled via the existing WhatsApp command mechanism in `server.ts`:

- `setIdentification multi-prompt` → enables new flow globally (in-memory)
- `setIdentification single-prompt` → reverts to current flow

The flag lives in `gemini-client.ts` as `identificationType` and is already exported via `setIdentificationType`. A new `getIdentificationType()` export will allow `schedule.ts` to read it.

---

## Flow

### Single-prompt (unchanged)

```
extractReminderData(message, userId)
  └─ generateContentWithContext(PROMPT_EXTRACT_REMINDER_DATA)
     → ReminderData[]
```

### Multi-prompt (new)

```
extractReminderData(message, userId)
  └─ extractReminderDataMultiPrompt(message, userId)
       │
       ├─ Step 1: generateContentWithContext(PROMPT_EXTRACT_REMINDER_BASE)
       │   Prompt focus: what + when only
       │   Returns: [{ title: string, date: string }, ...]
       │
       └─ Step 2: for each base reminder:
            generateContentWithContext(PROMPT_EXTRACT_RECURRENCE)
            Prompt focus: recurrence only, with explicit bias toward "none"
            Returns: {
              recurrence_type, recurrence_interval,
              max_occurrences, end_date
            }
       │
       └─ Merge base + recurrence → ReminderData[]
```

### Token / Context savings

Both steps share the same `ChatSession` (keyed by `userId`) within a single request. The AI retains Step 1 context when answering Step 2, so Step 2 prompts can be shorter — they reference the previously extracted reminder rather than repeating the full schema.

The session is cleared in the `finally` block of `processMessage`, unchanged.

---

## New Prompts (`gemini-constants.ts`)

### `PROMPT_EXTRACT_REMINDER_BASE(message, currentDateTime, weekday)`

- Extract **only** `title` (string) and `date` (string, format `YYYY-MM-DD HH:mm:ss`) for each reminder in the message.
- No recurrence fields in schema, no recurrence mentions in the prompt.
- Returns a JSON array: `[{ "title": "...", "date": "..." }]`

### `PROMPT_EXTRACT_RECURRENCE(originalMessage, title, date)`

- Given the original user message and one reminder (`title` + `date`), determine **only** the recurrence fields.
- Explicitly biased: if the message contains no clear recurring language, return `recurrence_type: "none"`, `recurrence_interval: 0`, `max_occurrences: null`, `end_date: null`.
- Returns a single JSON object: `{ "recurrence_type": "...", "recurrence_interval": 0, "max_occurrences": null, "end_date": null }`

---

## Code Changes

| File | Change |
|---|---|
| `src/integrations/ai/gemini-constants.ts` | Add `PROMPT_EXTRACT_REMINDER_BASE` and `PROMPT_EXTRACT_RECURRENCE` |
| `src/integrations/ai/gemini-client.ts` | Export `getIdentificationType()` |
| `src/domain/reminders/schedule.ts` | Add `extractReminderDataMultiPrompt`, branch in `extractReminderData` based on flag |

No changes to `server.ts`, `message-processor.ts`, or any other file.

---

## Error Handling

- Step 1 JSON parse failure → throw (same as current behavior).
- Step 2 JSON parse failure for a given reminder → fall back to `recurrence_type: "none"` with all nulls for that reminder; do not crash the whole request.

---

## Out of Scope

- Per-user flag persistence (flag is global, in-memory only).
- Changes to the `classify`, `delay`, `delete`, or `list` flows.
- New tests (existing test suite covers `ReminderData` shape; integration-level testing is manual via WhatsApp).
