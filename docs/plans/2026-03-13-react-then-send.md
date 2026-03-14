# React First, Then Send — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Swap the order so the bot reacts to the user's message first, then sends the reply, so WhatsApp's preview shows the emoji reaction instead of the bot's message.

**Architecture:** Inline swap at each call site: call `reactMessage(messageId, emoji)` before the send or before the domain function that sends. No new helpers. Add the missing ✅ reaction on the delay AI-extract success path.

**Tech Stack:** Node, Hono, existing WhatsApp integrations (react-message, send-message, send-messages).

---

## Task 1: message-processor — react then send in all branches

**Files:**
- Modify: `src/integrations/whatsapp/message-processor.ts`

**Step 1: Message too long (lines 21–28)**

Swap to react then send:

```ts
    if (message.length > 250) {
        console.log("[PROCESSOR] ⚠ Message too long:", message.length);
        await reactMessage(userData.messageId, "🚫");
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Infelizmente, não é possível enviar mensagens muito longas. Por favor, envie uma mensagem mais curta.",
        });
        return;
    }
```

**Step 2: Rate limit classify (lines 47–54)**

Swap to react then send:

```ts
            if (!rateLimitCheck.allowed) {
                const resetInHours = rateLimitCheck.resetIn / (1000 * 60 * 60);
                await reactMessage(userData.messageId, "🚫");
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: RATE_LIMIT_EXCEEDED_MESSAGE(resetInHours, userData.phoneNumber),
                });
                return;
            }
```

**Step 3: Free user limit (lines 75–81)**

Swap to react then send:

```ts
                    if (pendingRemindersCount >= 5) {
                        await reactMessage(userData.messageId, "😢");
                        await sendMessage({
                            phone: userData.phoneNumber,
                            message: FREE_USER_REMINDER_LIMIT_MESSAGE(userData.phoneNumber),
                        });
                        return;
                    }
```

**Step 4: Rate limit extract (lines 88–95)**

Swap to react then send:

```ts
                if (!rateLimitCheck.allowed) {
                    const resetInHours = rateLimitCheck.resetIn / (1000 * 60 * 60);
                    await reactMessage(userData.messageId, "🚫");
                    await sendMessage({
                        phone: userData.phoneNumber,
                        message: RATE_LIMIT_EXCEEDED_MESSAGE(resetInHours, userData.phoneNumber),
                    });
                    return;
                }
```

**Step 5: list_reminders (lines 108–110)**

Swap to react then listReminders:

```ts
            case "list_reminders":
                await reactMessage(userData.messageId, "📋");
                await listReminders({ userData });
                break;
```

**Step 6: delete_reminder (lines 113–115)**

Swap to react then deleteReminder:

```ts
            case "delete_reminder":
                await reactMessage(userData.messageId, "🗑️");
                await deleteReminder({ userData, quotedMsgId: body.quotedMsgId, messageText: body.body });
                break;
```

**Step 7: delay_reminder (lines 117–120)**

Swap to react then delayReminder:

```ts
            case "delay_reminder":
                await reactMessage(userData.messageId, "✅");
                await delayReminder({ userMessage: body.body, userData, quotedMsgId: body.quotedMsgId });
                break;
```

**Step 8: buy_premium (lines 122–128)**

Swap to react then send:

```ts
            case "buy_premium":
                await reactMessage(userData.messageId, "⭐");
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: BUY_PREMIUM_MESSAGE(userData.phoneNumber),
                });
                break;
```

**Step 9: thank (lines 130–136)**

Swap to react then send:

```ts
            case "thank":
                await reactMessage(userData.messageId, "😊");
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: "De nada! Estou aqui para ajudar. Se precisar de algo, é só falar!",
                });
                break;
```

**Step 10: help/default (lines 138–146)**

Swap to react then sendMessages:

```ts
            case "help":
            default:
                await reactMessage(userData.messageId, "ℹ️");
                await sendMessages({
                    phone: userData.phoneNumber,
                    messages: HELP_MESSAGES,
                });
                break;
```

**Step 11: Run tests**

Run: `npm test`  
Expected: All tests pass.

**Step 12: Commit**

```bash
git add src/integrations/whatsapp/message-processor.ts
git commit -m "refactor(whatsapp): react first then send in message-processor"
```

---

## Task 2: delay.ts — react then send and add missing reaction

**Files:**
- Modify: `src/domain/reminders/delay.ts`

**Step 1: Reminder not found (lines 44–50)**

Swap to react then send:

```ts
    if (!reminder) {
        await reactMessage(userData.messageId, "🚫");
        await sendMessage({
            phone: userData.phoneNumber,
            message: "Não foi possível encontrar seu lembrete a ser adiado.",
        });
        return;
    }
```

**Step 2: Add 5 minutes (lines 56–63)**

Swap to react then send:

```ts
        reminder.scheduledTime = new Date(reminder.scheduledTime.getTime() + 5 * 60 * 1000);
        reminder.status = "pending";
        await reminder.save();

        await reactMessage(userData.messageId, "✅");
        await sendMessage({
            phone: userData.phoneNumber,
            message: `Lembrete adiado com sucesso para daqui 5 minutos.`,
        });
        return;
```

**Step 3: AI-extract success (lines 80–84) — add react then send**

Add react before the existing sendMessage:

```ts
        const formattedNewTime = formatFriendlyDateTime(reminder.scheduledTime);
        await reactMessage(userData.messageId, "✅");
        await sendMessage({
            phone: userData.phoneNumber,
            message: `Lembrete "${reminder.title}" adiado com sucesso para ${formattedNewTime}.`,
        });
```

**Step 4: AI-extract error (lines 85–93)**

Swap to react then send:

```ts
    } catch (error) {
        console.error("[DELAY REMINDER] Failed to extract or parse delay data:", error);
        await reactMessage(userData.messageId, "🚫");
        await sendMessage({
            phone: userData.phoneNumber,
            message:
                "Erro ao processar o adiamento. Tente novamente com um formato válido (ex: '30 minutos', '2 dias', 'Dia 10/05 às 09:00').",
        });
    }
```

**Step 5: Run tests**

Run: `npm test`  
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/domain/reminders/delay.ts
git commit -m "refactor(delay): react first then send; add missing reaction on AI success"
```

---

## Task 3: Final verification

**Step 1: Full test run**

Run: `npm test`  
Expected: All tests pass.

**Step 2: Commit design doc (if not already committed)**

```bash
git add docs/plans/2026-03-13-react-then-send-design.md docs/plans/2026-03-13-react-then-send.md
git commit -m "docs: add react-then-send design and implementation plan"
```

---

Plan complete. Design is in `docs/plans/2026-03-13-react-then-send-design.md`. Implementation plan is in `docs/plans/2026-03-13-react-then-send.md`.

**Execution options:**

1. **Subagent-driven (this session)** — I run each task (or subagent per task), you review between tasks.
2. **Parallel session** — You open a new session (e.g. in a worktree), use executing-plans, and run the plan there with checkpoints.

Which do you prefer?
