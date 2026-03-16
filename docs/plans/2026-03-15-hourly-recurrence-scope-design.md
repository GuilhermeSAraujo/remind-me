# Hourly Recurrence Scope Fix

**Date:** 2026-03-15  
**Status:** Approved

## Problem

Reminders like "Me lembrar de tomar o remédio de quatro em quatro horas" are incorrectly scheduled as infinite hourly recurrence. The user's intent is one-day-only, but the AI treats the interval as eternal because no explicit end is mentioned.

## Goal

When a user specifies an hourly interval without an explicit multi-day scope, the reminder should fire only for the rest of today, not forever.

## Decision

**Approach A — Prompt-only.** Add a new rule and contrasting examples to both recurrence prompts. No code changes needed; the AI already receives the current date and can compute end-of-day.

Code-based keyword guards were rejected as too fragile and hard to maintain.

## Rule

For `recurrence_type: "hourly"`:

| Message contains | end_date |
|---|---|
| No multi-day scope (`todo dia`, `diariamente`, `toda semana`, `durante X dias`, etc.) | today at `23:59:59` |
| Explicit "hoje" (and no further scope) | today at `23:59:59` |
| Explicit duration (`durante 5 dias`) | first occurrence + duration |
| Eternal marker (`todo dia`, `diariamente`) | `null` |

## Files Changed

- `src/integrations/ai/gemini-constants.ts`
  - `PROMPT_EXTRACT_RECURRENCE` — add rule + examples, clean redundant content
  - `PROMPT_EXTRACT_REMINDER_DATA` — same

## Examples Added

```
"Me lembrar de tomar o remédio de quatro em quatro horas"
→ hourly, interval 4, end_date = today 23:59:59

"Tomar remédio hoje de quatro em quatro horas"
→ hourly, interval 4, end_date = today 23:59:59

"Tomar remédio de hora em hora todo dia"
→ hourly, interval 1, end_date = null

"Tomar remédio a cada 4h durante 3 dias"
→ hourly, interval 4, end_date = 3 days from first occurrence
```
