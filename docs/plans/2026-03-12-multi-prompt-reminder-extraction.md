# Multi-Prompt Reminder Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break single-prompt reminder extraction into two focused prompts (base fields + recurrence fields) to eliminate recurrence misidentification, gated behind the existing global `identificationType` feature flag.

**Architecture:** `extractReminderData` in `schedule.ts` branches on `getIdentificationType()`: if `"multi-prompt"`, it calls `extractReminderDataMultiPrompt` which runs Step 1 (base: title + date only) then Step 2 (recurrence only) per reminder using the same shared `ChatSession`, then merges results. If `"single-prompt"`, the existing path is used unchanged.

**Tech Stack:** TypeScript, Hono, Google Generative AI (`@google/generative-ai`), Mongoose/MongoDB, Bun test runner (`bun test`)

---

### Task 1: Export `getIdentificationType` from `gemini-client.ts`

**Files:**
- Modify: `src/integrations/ai/gemini-client.ts:13-21`

**Step 1: Write the failing test**

There are no unit tests for `gemini-client.ts` yet. Skip to implementation — this is a trivial export.

**Step 2: Add the export**

In `src/integrations/ai/gemini-client.ts`, after the existing `setIdentificationType` function, add:

```typescript
export function getIdentificationType(): "single-prompt" | "multi-prompt" {
  return identificationType as "single-prompt" | "multi-prompt";
}
```

**Step 3: Verify TypeScript compiles**

Run: `bun run tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/integrations/ai/gemini-client.ts
git commit -m "feat: export getIdentificationType from gemini-client"
```

---

### Task 2: Add `PROMPT_EXTRACT_REMINDER_BASE` to `gemini-constants.ts`

**Files:**
- Modify: `src/integrations/ai/gemini-constants.ts` (append after line 185)

**Step 1: Write the prompt**

Append to `src/integrations/ai/gemini-constants.ts`:

```typescript
export const PROMPT_EXTRACT_REMINDER_BASE = (
    message: string,
    currentDateTime: string,
    weekday: string,
) => `
You are given a message from a user and you need to extract reminders from it.
The user message is: ${message}
Current date and time is: ${currentDateTime}. The weekday is ${weekday}.

Extract ALL reminders from the message. If there's only one reminder, return an array with one element.
Respond ONLY with a valid JSON ARRAY in PLAINTEXT format with the following structure:
[
    {
        "title": string,
        "date": string   (format: "YYYY-MM-DD HH:mm:ss")
    }
]

RULES FOR date:
- Schedule for the first occurrence that makes sense based on the message.
- If the time has already passed today, schedule for the next appropriate occurrence.
- If no time is specified, use a sensible default (e.g. 08:00:00).

Example: Me lembre de comprar pão às 14h
[
    {
        "title": "Comprar pão",
        "date": "2026-01-17 14:00:00"
    }
]

Example: Me lembre de lavar louça toda terça-feira 14h e de ir ao mercado toda quarta-feira 19h
[
    {
        "title": "Lavar louça",
        "date": "2026-01-21 14:00:00"
    },
    {
        "title": "Ir ao mercado",
        "date": "2026-01-22 19:00:00"
    }
]
`;
```

**Step 2: Verify TypeScript compiles**

Run: `bun run tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/integrations/ai/gemini-constants.ts
git commit -m "feat: add PROMPT_EXTRACT_REMINDER_BASE prompt"
```

---

### Task 3: Add `PROMPT_EXTRACT_RECURRENCE` to `gemini-constants.ts`

**Files:**
- Modify: `src/integrations/ai/gemini-constants.ts` (append after Task 2 addition)

**Step 1: Write the prompt**

Append to `src/integrations/ai/gemini-constants.ts`:

```typescript
export const PROMPT_EXTRACT_RECURRENCE = (
    originalMessage: string,
    title: string,
    date: string,
) => `
You already identified a reminder: title "${title}", scheduled for ${date}.
The original user message was: ${originalMessage}

Now extract ONLY the recurrence information for this reminder.
Respond ONLY with a valid JSON OBJECT in PLAINTEXT format:
{
    "recurrence_type": "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "weekday" | "weekend" | "none",
    "recurrence_interval": number,
    "max_occurrences": number | null,
    "end_date": string | null   (format: "YYYY-MM-DD HH:mm:ss")
}

CRITICAL RULES:
- Default to "none" with interval 0. Only set a recurrence type if the message CLEARLY and EXPLICITLY states repetition.
- Words like "todo dia", "toda semana", "diariamente", "semanalmente", "a cada X", "toda terça", etc. indicate recurrence.
- A single future date ("amanhã", "na sexta", "às 14h") is NOT recurrence — use "none".
- max_occurrences: set only if the user specifies a finite count (e.g. "5 vezes", "3x"). Otherwise null.
- end_date: set only if the user specifies a duration or end date (e.g. "durante 5 dias", "até sexta"). Otherwise null.

Example: Me lembre de comprar pão às 14h  →  title "Comprar pão"
{"recurrence_type":"none","recurrence_interval":0,"max_occurrences":null,"end_date":null}

Example: Me lembre de fazer exercício todos os dias às 7h  →  title "Fazer exercício"
{"recurrence_type":"daily","recurrence_interval":1,"max_occurrences":null,"end_date":null}

Example: Me lembre de tomar remédio a cada 8h durante 5 dias  →  title "Tomar remédio"
{"recurrence_type":"hourly","recurrence_interval":8,"max_occurrences":null,"end_date":"2026-03-16 08:00:00"}

Example: Me lembre de olhar o celular 5x a cada 15 minutos  →  title "Olhar o celular"
{"recurrence_type":"hourly","recurrence_interval":0.25,"max_occurrences":5,"end_date":null}
`;
```

**Step 2: Verify TypeScript compiles**

Run: `bun run tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/integrations/ai/gemini-constants.ts
git commit -m "feat: add PROMPT_EXTRACT_RECURRENCE prompt"
```

---

### Task 4: Add `extractReminderDataMultiPrompt` to `schedule.ts` and branch on flag

**Files:**
- Modify: `src/domain/reminders/schedule.ts:1-5` (imports)
- Modify: `src/domain/reminders/schedule.ts:83-93` (`extractReminderData` function)

**Step 1: Update imports**

At the top of `src/domain/reminders/schedule.ts`, update the import from `gemini-client`:

```typescript
import { generateContentWithContext, getIdentificationType } from "../../integrations/ai/gemini-client";
```

Update the import from `gemini-constants`:

```typescript
import {
    PROMPT_EXTRACT_REMINDER_DATA,
    PROMPT_EXTRACT_REMINDER_BASE,
    PROMPT_EXTRACT_RECURRENCE,
} from "../../integrations/ai/gemini-constants";
```

**Step 2: Add the `BaseReminderData` interface**

After the existing `ReminderData` interface (around line 81), add:

```typescript
interface BaseReminderData {
    title: string;
    date: string;
}

interface RecurrenceData {
    recurrence_type: ReminderData["recurrence_type"];
    recurrence_interval: number;
    max_occurrences: number | null;
    end_date: string | null;
}

const RECURRENCE_FALLBACK: RecurrenceData = {
    recurrence_type: "none",
    recurrence_interval: 0,
    max_occurrences: null,
    end_date: null,
};
```

**Step 3: Add `extractReminderDataMultiPrompt`**

After the existing `extractReminderData` function, add:

```typescript
async function extractReminderDataMultiPrompt(
    message: string,
    userId: string,
): Promise<ReminderData[]> {
    await startTyping({ phone: userId });

    // Step 1: extract base fields (title + date only)
    let baseRaw = await generateContentWithContext(
        userId,
        PROMPT_EXTRACT_REMINDER_BASE(message, toBrazilDateTimeString(new Date()), getBrazilWeekday()),
        "extract",
    );
    baseRaw = baseRaw.replace(/```json/g, "").replace(/```/g, "");
    const baseReminders = JSON.parse(baseRaw) as BaseReminderData[];

    // Step 2: extract recurrence for each reminder (reuses same chat session context)
    const reminders: ReminderData[] = [];
    for (const base of baseReminders) {
        let recurrenceData: RecurrenceData = RECURRENCE_FALLBACK;
        try {
            let recurrenceRaw = await generateContentWithContext(
                userId,
                PROMPT_EXTRACT_RECURRENCE(message, base.title, base.date),
                "extract",
            );
            recurrenceRaw = recurrenceRaw.replace(/```json/g, "").replace(/```/g, "");
            recurrenceData = JSON.parse(recurrenceRaw) as RecurrenceData;
        } catch (err) {
            console.warn(
                `[AI] Recurrence extraction failed for "${base.title}", falling back to none:`,
                err,
            );
        }

        reminders.push({
            title: base.title,
            date: base.date,
            recurrence_type: recurrenceData.recurrence_type,
            recurrence_interval: recurrenceData.recurrence_interval,
            max_occurrences: recurrenceData.max_occurrences,
            end_date: recurrenceData.end_date,
        });
    }

    return reminders;
}
```

**Step 4: Branch in `extractReminderData`**

Replace the body of `extractReminderData` with:

```typescript
async function extractReminderData(message: string, userId: string): Promise<ReminderData[]> {
    if (getIdentificationType() === "multi-prompt") {
        return extractReminderDataMultiPrompt(message, userId);
    }

    await startTyping({ phone: userId });
    let reminderData = await generateContentWithContext(
        userId,
        PROMPT_EXTRACT_REMINDER_DATA(message, toBrazilDateTimeString(new Date()), getBrazilWeekday()),
        "extract",
    );
    reminderData = reminderData.replace(/```json/g, "").replace(/```/g, "");
    return JSON.parse(reminderData) as ReminderData[];
}
```

**Step 5: Verify TypeScript compiles**

Run: `bun run tsc --noEmit`
Expected: No errors.

**Step 6: Run existing tests**

Run: `bun test`
Expected: All existing tests pass (no changes to `ReminderData` shape or recurrence utils).

**Step 7: Commit**

```bash
git add src/domain/reminders/schedule.ts
git commit -m "feat: add multi-prompt reminder extraction behind identificationType flag"
```

---

### Task 5: Smoke test via WhatsApp

Manual verification steps (no automated test needed — AI output is non-deterministic):

1. Send `setIdentification multi-prompt` to the bot.
2. Send a one-time reminder: `Me lembre de comprar pão amanhã às 14h`
   - Expected: `recurrence_type: "none"` in DB, confirmation message shows no recurrence string.
3. Send a recurring reminder: `Me lembre de fazer exercício todos os dias às 7h`
   - Expected: `recurrence_type: "daily"`, `recurrence_interval: 1`.
4. Send a multi-reminder message: `Me lembre de lavar louça toda terça 14h e ir ao mercado toda quarta 19h`
   - Expected: two reminders created, both `weekly`.
5. Send `setIdentification single-prompt` and repeat steps 2–4 to confirm original path still works.
