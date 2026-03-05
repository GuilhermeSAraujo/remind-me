# Remind Me — Product Document

## Overview

**Remind Me** is a WhatsApp chatbot that allows Brazilian Portuguese-speaking users to create, manage, and receive personal reminders entirely through natural-language text messages. There is no app to install and no web interface to learn — the user simply sends a message like *"Me lembre de tomar remédio amanhã às 10h"* and the bot handles everything from scheduling to delivery.

The product targets everyday smartphone users in Brazil who already live inside WhatsApp and want a frictionless reminder experience without switching to a dedicated app.

---

## Problem Being Solved

Most reminder apps require installation, account creation, and navigation through a UI. WhatsApp is already open on almost every Brazilian's phone. Remind Me meets users where they already are, removing every barrier between having a thought and setting a reminder.

---

## How It Works (End-to-End Flow)

```
User → WhatsApp → WPPConnect Server → Remind Me Bot → AI (Gemini) → MongoDB
                                                    ↓
                                      WPPConnect Server → WhatsApp → User
```

1. The user sends a WhatsApp message to the bot's number.
2. **WPPConnect Server** (a self-hosted WhatsApp Web bridge) receives the message and forwards it as a webhook `POST /` to the Remind Me server.
3. The server identifies the user by phone number and creates an account if they are new.
4. The intent of the message is detected — first using fast regex patterns, then using Google Gemini AI as a fallback.
5. The appropriate action is executed (create, list, delete, or delay a reminder).
6. A confirmation reply is sent back through the WPPConnect Server to the user's WhatsApp.
7. A `cron` job runs every minute to check for due reminders and deliver them via WhatsApp.

All communication happens entirely in **Brazilian Portuguese**.

---

## Features

### Creating Reminders

Users describe what they want to be reminded of in plain language. A single message can create multiple reminders at once.

- One-time reminders: *"Me lembre de ligar para o médico amanhã às 14h"*
- Recurring reminders: *"Me lembre de tomar vitamina todo dia às 8h"*

Supported recurrence types: **hourly, daily, weekly, monthly, yearly, weekdays only, weekends only**.

### Listing Reminders

Sending a message like *"listar"* or *"quais são meus lembretes"* returns a numbered list of all pending reminders sorted by scheduled time.

### Deleting Reminders

Reminders can be deleted in two ways:
- Reply to any bot message with *"apagar"* (or synonyms like *"deletar"*, *"excluir"*) — the bot figures out which reminder the user is referring to.
- Send *"apagar 2"* to delete reminder number 2 from the list.

If deletion fails (e.g. no reminder found), the bot sends an explanatory image showing how to do it correctly.

### Delaying Reminders

Users can reply to a reminder notification with a delay instruction:
- *"Adiar 30 minutos"* — reschedules by 30 minutes.
- *"amanhã"* — reschedules to the next day.
- A single character (e.g. *"1"*) — defaults to +5 minutes.

### Help

Sending *"ajuda"* or *"help"* causes the bot to send a multi-message help card explaining all available commands.

### Greetings & Thanks

The bot responds politely to greetings (*"oi"*, *"olá"*) and expressions of thanks.

---

## User Experience Details

- **Typing indicator**: The bot shows "typing…" while processing every message, making the interaction feel live and conversational.
- **Message reactions**: The bot reacts to every user message with an emoji reflecting the outcome — ⏳ (processing), ✅ (done), 🗑️ (deleted), 🚫 (blocked/limit reached).
- **Random reminder prefixes**: Delivery messages use varied prefixes (e.g. *"🔔 Lembrete:"*, *"⏰ Hora do:"*) to avoid feeling robotic.
- **Context awareness**: When deleting or delaying, the bot inspects the quoted/replied-to message to figure out which reminder the user means — no need to look up a number.

---

## Business Model: Freemium

### Free Tier
- Maximum **5 pending reminders** at a time.
- Maximum **5 AI-assisted interactions per 24 hours** (sliding window).
- New users receive **30 days of free Premium** automatically upon registration.

### Premium Tier
- **Unlimited** pending reminders.
- **Unlimited** AI interactions.
- Price: **R$ 4.90 / month**.
- Activated via a payment link sent by the bot.

### Premium Activation Flow
1. User hits a free-tier limit; the bot replies with an explanation and a payment link.
2. The payment link points to an external Google Cloud Run function that processes the payment.
3. On successful payment, the Cloud Run function inserts a `PremiumPayment` document into MongoDB.
4. A MongoDB **Change Stream** watcher inside the bot detects the new document in real time.
5. The bot automatically sends the user a welcome message on WhatsApp and upgrades their account.

---

## Intent Detection: Hybrid Approach

To minimize AI costs, intent detection uses two layers:

1. **Regex patterns** (fast, free): The first three words of each message are checked against a set of known command patterns (list, delete, delay, help, thanks, greetings). If matched, no AI call is made.
2. **Gemini AI fallback** (slower, costs tokens): When regex does not match, the message is sent to Gemini to classify the intent. This also handles extracting reminder details (title, date/time, recurrence) from free-form text.

AI usage is tracked per-user with a 24-hour token window stored in MongoDB, enforcing the free-tier limit.

---

## Data Models

### User
| Field | Type | Description |
|---|---|---|
| `phoneNumber` | String | Unique identifier, sourced from WhatsApp |
| `name` | String | WhatsApp display name |
| `isPremium` | Boolean | Whether the user has an active Premium subscription |
| `premiumExpiresAt` | Date | Expiry date of the Premium period |
| `aiUsage` | Object | Token usage log for rate limiting |

### Reminder
| Field | Type | Description |
|---|---|---|
| `userPhoneNumber` | String | Owner's phone number |
| `title` | String | What to remind the user of |
| `scheduledTime` | Date | When to deliver the reminder |
| `recurrence_type` | Enum | `none`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `weekday`, `weekend` |
| `recurrence_interval` | Number | Interval multiplier for the recurrence type |
| `status` | Enum | `pending`, `sent`, `cancelled` |
| `messageId` | String | WhatsApp message ID that created this reminder |

### PremiumPayment
| Field | Type | Description |
|---|---|---|
| `userPhoneNumber` | String | Paying user |
| `messageSent` | Boolean | Whether the welcome message has been sent |

Records auto-delete after **30 days** via a TTL index.

---

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 (ESM, TypeScript) |
| Web Framework | Hono + `@hono/node-server` |
| Database | MongoDB (replica set, for Change Streams) |
| AI | Google Gemini (`gemini-2.5-flash-lite`) |
| WhatsApp Bridge | WPPConnect Server (self-hosted REST API) |
| Scheduler | `cron` (every minute) |
| Validation | Zod + `@t3-oss/env-core` |
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions → SSH deploy |

### Deployment

The bot runs on a Raspberry Pi-class server. GitHub Actions builds and pushes a Docker image on every push to `main`, then connects via SSH to pull and redeploy. The WPPConnect Server runs as a separate container on the same host.

### Timezone

The server forces `America/Sao_Paulo` (UTC-3 / BRT) at startup. All scheduling, date parsing, and reminder delivery operate in Brazilian time.

---

## Constraints and Limitations

- **WhatsApp account required**: The bot only works over WhatsApp; there is no SMS, email, or app fallback.
- **Brazilian Portuguese only**: All prompts, AI instructions, and UX copy are in PT-BR.
