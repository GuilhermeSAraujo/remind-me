# Hourly Recurrence Scope Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix AI prompts so hourly reminders without an explicit multi-day scope are capped to end-of-today instead of repeating forever.

**Architecture:** Prompt-only fix in `gemini-constants.ts`. Add an explicit hourly scope rule and contrasting examples to both `PROMPT_EXTRACT_RECURRENCE` (multi-prompt mode) and `PROMPT_EXTRACT_REMINDER_DATA` (single-prompt mode). Also take the opportunity to trim repeated/redundant content in both prompts.

**Tech Stack:** TypeScript, Gemini AI prompt strings.

---

### Task 1: Update `PROMPT_EXTRACT_RECURRENCE`

**Files:**
- Modify: `src/integrations/ai/gemini-constants.ts` — `PROMPT_EXTRACT_RECURRENCE` function (lines ~305–365)

**Step 1: Read the current prompt carefully**

Open `src/integrations/ai/gemini-constants.ts` and read `PROMPT_EXTRACT_RECURRENCE` in full.

**Step 2: Apply changes**

Make the following edits inside `PROMPT_EXTRACT_RECURRENCE`:

1. **In `CRITICAL RULES`**, change the line:
   > `- Words like "todo dia", "toda semana", "diariamente", "semanalmente", "a cada X", "toda terça", etc. indicate recurrence.`

   To remove `"a cada X"` (bare intervals are *not* enough to indicate eternal recurrence) and add the hourly scope sub-rule:
   ```
   - Words like "todo dia", "toda semana", "diariamente", "semanalmente", "toda terça", etc. indicate recurrence.
   - HOURLY SCOPE RULE: for recurrence_type "hourly" —
     • No multi-day scope present ("todo dia", "diariamente", "toda semana", "durante X dias", "por X dias"): set end_date to [currentDate] 23:59:59.
     • Explicit duration ("durante 5 dias"): compute end_date = first occurrence + duration (existing behaviour).
     • Eternal marker present ("todo dia", "diariamente"): leave end_date null.
   ```
   Note: the current date is passed as part of the reminder context already visible to the model in the same chat session.

2. **Remove the verbose calendar-type sub-sections** (`For recurrence_type "monthly_nth_weekday"`, `monthly_last_business_day`, `monthly_first_business_day`). These are already explained in detail in `PROMPT_EXTRACT_REMINDER_BASE` / `PROMPT_EXTRACT_REMINDER_DATA`. Keeping them here is redundant and inflates the prompt. Replace with a single line:
   ```
   - For calendar rule types (monthly_nth_weekday, monthly_last_business_day, monthly_first_business_day): fill recurrence_weekday and recurrence_nth as the user specifies.
   ```

3. **Add two new examples** (before the closing backtick of the template literal), contrasting day-scoped vs eternal vs duration:

   ```
   Example: Me lembrar de tomar o remédio de quatro em quatro horas  →  title "Tomar remédio"
   {"recurrence_type":"hourly","recurrence_interval":4,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":"[currentDate] 23:59:59"}

   Example: Tomar remédio hoje de quatro em quatro horas  →  title "Tomar remédio"
   {"recurrence_type":"hourly","recurrence_interval":4,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":"[currentDate] 23:59:59"}

   Example: Tomar remédio de hora em hora todo dia  →  title "Tomar remédio"
   {"recurrence_type":"hourly","recurrence_interval":1,"recurrence_weekday":null,"recurrence_nth":null,"max_occurrences":null,"end_date":null}
   ```
   Replace `[currentDate]` with the actual current date string interpolated from the `date` parameter already available in the template (e.g. `${date.split(" ")[0]}`). The function signature already receives `date: string` — use it.

   Wait — check the actual signature of `PROMPT_EXTRACT_RECURRENCE`. It currently receives `(originalMessage, title, date)`. The `date` is the first occurrence date string (e.g. "2026-03-15 08:00:00"). Extract the date portion: `${date.split(" ")[0]}`.

**Step 3: Verify the prompt reads cleanly**

Re-read the whole prompt after edits. It should be noticeably shorter and have no duplicate rule blocks.

**Step 4: Commit**

```bash
git add src/integrations/ai/gemini-constants.ts
git commit -m "fix(prompt): cap hourly recurrence to end-of-day when no multi-day scope in PROMPT_EXTRACT_RECURRENCE"
```

---

### Task 2: Update `PROMPT_EXTRACT_REMINDER_DATA`

**Files:**
- Modify: `src/integrations/ai/gemini-constants.ts` — `PROMPT_EXTRACT_REMINDER_DATA` function (lines ~37–234)

**Step 1: Read the current prompt carefully**

Focus on the `end_date` and `max_occurrences` rules block, and the hourly example (line ~181).

**Step 2: Apply changes**

1. **Add hourly scope rule** after the existing `For max_occurrences` and `For end_date` blocks:
   ```
   HOURLY SCOPE RULE: for recurrence_type "hourly" —
   • No multi-day scope present ("todo dia", "diariamente", "toda semana", "durante X dias", "por X dias"): set end_date to [currentDate] 23:59:59, where currentDate is today's date from the current date/time provided above.
   • Explicit duration ("durante 5 dias"): compute end_date = first occurrence + duration (existing behaviour).
   • Eternal marker present ("todo dia", "diariamente"): leave end_date null.
   ```

2. **Clean up calendar rule blocks.** The four calendar-type sub-sections (`For recurrence_type "weekday"`, `"weekend"`, `"monthly_nth_weekday"`, `"monthly_last_business_day"`, `"monthly_first_business_day"`) are under `IMPORTANT RULES FOR CALCULATING THE FIRST OCCURRENCE` and are about *scheduling the first date*, which is correct to keep. However, the `monthly_nth_weekday` and `monthly_last/first_business_day` sub-sections repeat the `recurrence_weekday`/`recurrence_nth` assignment instructions that are already in the field schema. Trim those sub-sections to just the scheduling logic (how to compute `date`), removing the field assignment repetitions.

3. **Add three new examples** after the existing "Me lembre de olhar o celular 5x" example:

   ```
   Example: Me lembrar de tomar o remédio de quatro em quatro horas (current date 2026-03-15)
   [
       {
           title: "Tomar remédio",
           date: "2026-03-15 08:00:00",
           recurrence_type: "hourly",
           recurrence_interval: 4,
           recurrence_weekday: null,
           recurrence_nth: null,
           max_occurrences: null,
           end_date: "2026-03-15 23:59:59"
       }
   ]

   Example: Tomar remédio hoje de quatro em quatro horas (current date 2026-03-15)
   [
       {
           title: "Tomar remédio",
           date: "2026-03-15 08:00:00",
           recurrence_type: "hourly",
           recurrence_interval: 4,
           recurrence_weekday: null,
           recurrence_nth: null,
           max_occurrences: null,
           end_date: "2026-03-15 23:59:59"
       }
   ]

   Example: Tomar remédio de hora em hora todo dia (current date 2026-03-15)
   [
       {
           title: "Tomar remédio",
           date: "2026-03-15 08:00:00",
           recurrence_type: "hourly",
           recurrence_interval: 1,
           recurrence_weekday: null,
           recurrence_nth: null,
           max_occurrences: null,
           end_date: null
       }
   ]
   ```

**Step 3: Verify**

Re-read the full prompt. It should be leaner than before with no duplicate field-assignment instructions.

**Step 4: Commit**

```bash
git add src/integrations/ai/gemini-constants.ts
git commit -m "fix(prompt): cap hourly recurrence to end-of-day when no multi-day scope in PROMPT_EXTRACT_REMINDER_DATA"
```

---

### Task 3: Manual smoke test

No automated tests cover live AI prompt responses (the existing tests mock the AI). Verify manually by sending these messages via WhatsApp or the local dev environment:

| Message | Expected end_date | Expected recurrence_type |
|---|---|---|
| "Me lembrar de tomar o remédio de quatro em quatro horas" | today 23:59:59 | hourly |
| "Tomar remédio hoje de quatro em quatro horas" | today 23:59:59 | hourly |
| "Tomar remédio de hora em hora todo dia" | null | hourly |
| "Me lembre de tomar remédio a cada 8h durante 5 dias" | 5 days from first occurrence | hourly |
| "Me lembre de comprar pão às 14h" | null | none |

Confirm that the confirmation message sent back to the user shows the correct `end_date` (e.g. "até 15/03/2026") for day-scoped cases and no end date for eternal ones.
