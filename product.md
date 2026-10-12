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
4. Jev (TypeSafe) classifies the message. Gemini is used only to extract a reminder's title and date, and as the fallback for recurrence.
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

Reminders can be deleted in three ways:
- Send *"apagar 2"* to delete reminder number 2 from the numbered list.
- Reply to the reminder message with *"apagar"* — the quoted message is matched to the reminder title.
- Describe it, for example *"apaga o de comprar pão"*. Jev picks among the pending reminders. Confidence below 0.8, or no match, replies with the numbered list and asks for *"apagar N"*.

If deletion fails (e.g. no reminder found), the bot sends an explanatory image showing how to do it correctly.

### Delaying Reminders

Users can reply to a reminder notification with a delay instruction. Jev chooses the unit (minutes, hours, or days) and the amount; the code adds that interval to the current time. *"Adiar 30 minutos"*, *"Adiar 2 horas"*, and *"Adiar 1 dia"* are valid. *"amanhã"* and a bare *"1"* do not delay a reminder. Below a confidence of 0.6 the bot keeps the error and shows an example.

### Contacts and reminders for others

Users can invite another person as a contact and schedule reminders **for** that person.

- **Invite:** *"Cadastrar pessoa (31)999999999 Victor"* sends an invite. The invitee accepts or rejects with *"sim"* / *"não"* (punctuation such as *"Sim!"* and *"não."* counts), a 👍 / 👎, or a longer reply such as *"pode sim, aceito"* when an invite is pending. Both parties are notified when the invite is answered.
- **List contacts:** *"Contatos"* shows accepted contacts (or guidance if the list is empty).
- **Schedule for a contact:** *"Lembre a Victor amanhã 12h de passear com o cachorro"*. The **owner** (`userPhoneNumber`) is who receives the reminder and can delete/delay it; the **creator** (`createdByPhoneNumber`) is who scheduled it.
- **List reminders:** numbered list = reminders the user owns; below that, an unnumbered readonly section shows reminders they created for others. *"apagar N"* only applies to the numbered list.
- All feedback for this feature is always in **Brazilian Portuguese**, with a clear next step.

### Help

Sending *"ajuda"* or *"help"* causes the bot to send a multi-message help card explaining all available commands.

### Greetings & Thanks

The bot responds politely to greetings (*"oi"*, *"olá"*) and expressions of thanks.

---

## User Experience Details

- **Typing indicator**: The bot shows "typing…" while processing every message, making the interaction feel live and conversational.
- **Message reactions**: The bot reacts to every user message with an emoji reflecting the outcome — ⏳ (processing), ✅ (done), 🗑️ (deleted), 🚫 (blocked/limit reached).
- **Random reminder prefixes**: Delivery messages use varied prefixes (e.g. *"🔔 Lembrete:"*, *"⏰ Hora do:"*) to avoid feeling robotic.
- **Context awareness**: When delaying, or when deleting by reply, the bot inspects the quoted message to figure out which reminder the user means. A delete that is not a reply and not *"apagar N"* is matched by description.

---

## Business Model: Freemium

### Free Tier
- Maximum **3 reminders created per 24 hours** (sliding window). Each saved reminder counts, including one created for a contact. Deleting a reminder does not restore a slot. Delays, lists, and failed extracts do not count.
- New users receive **30 days of free Premium** automatically upon registration.

### Premium Tier
- **Unlimited** reminder creation.
- Price: **R$ 4.90 / month**.
- Activated via a payment link sent by the bot.

### Premium Activation Flow
1. User hits a free-tier limit; the bot replies with an explanation and a payment link.
2. The payment link points to an external Google Cloud Run function that processes the payment.
3. On successful payment, the Cloud Run function inserts a `PremiumPayment` document into MongoDB.
4. A MongoDB **Change Stream** watcher inside the bot detects the new document in real time.
5. The bot automatically sends the user a welcome message on WhatsApp and upgrades their account.

---

## Intent Detection

An exact yes/no (including edge punctuation) or a reaction on the invite message is handled before classification. Every other inbound message is one Jev call: intent, who the reminder is for, which word names that person, and — only when a contact invite is pending — whether the message accepts or rejects it. An invite answer at confidence 0.7 or higher is applied and the message is not routed further. Intent confidence below 0.5 is treated as help.

Gemini extracts the title and the first date of a reminder. Jev answers typed recurrence questions, and Gemini is the fallback when an end date is a calendar phrase or a confidence is below 0.6. Delay does not use Gemini. Free-tier usage is the number of reminders saved in a sliding 24-hour window, stored as timestamps on the user.

---

## Data Models

### User
| Field | Type | Description |
|---|---|---|
| `phoneNumber` | String | Unique identifier, sourced from WhatsApp |
| `name` | String | WhatsApp display name |
| `isPremium` | Boolean | Whether the user has an active Premium subscription |
| `premiumExpiresAt` | Date | Expiry date of the Premium period |
| `reminderCreations` | Date[] | Timestamps of reminders this user saved, used for the free-tier daily cap |

### Reminder
| Field | Type | Description |
|---|---|---|
| `userPhoneNumber` | String | Owner's phone number (who receives the reminder) |
| `createdByPhoneNumber` | String | Who scheduled the reminder (equals owner for self-reminders) |
| `title` | String | What to remind the user of |
| `scheduledTime` | Date | When to deliver the reminder |
| `recurrence_type` | Enum | `none`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `weekday`, `weekend` |
| `recurrence_interval` | Number | Interval multiplier for the recurrence type |
| `status` | Enum | `pending`, `sent`, `cancelled` |
| `messageId` | String | WhatsApp message ID that created this reminder |

### Contact
| Field | Type | Description |
|---|---|---|
| `inviterPhoneNumber` | String | Who sent the invite |
| `inviteePhoneNumber` | String | Who was invited (may not be a User yet) |
| `inviterNicknameForInvitee` | String | Nickname the inviter chose for the invitee |
| `inviteeNicknameForInviter` | String \| null | Set on accept from the inviter's `User.name` |
| `status` | Enum | `pending`, `accepted`, `rejected` |
| `inviteMessageId` | String | WhatsApp message ID of the invite sent to the invitee |

One document per inviter → invitee pair. A reminder created for a contact counts toward the creator's daily free-tier quota.

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
