# Contact reminders (reminders for other users)

**Date:** 2026-08-27  
**Status:** Approved (design)

## Goal

Users can add another person as a contact (invite + accept) and then schedule reminders **for** that person. The **owner** of the reminder is the person who will receive it; only they can delete or delay it. The **creator** can see those reminders as a readonly section when they list.

All bot copy for this feature is **Brazilian Portuguese**. Every user-facing step must send a message: confirm what happened and say what to do next. No silent success, no silent ignore of an invite answer.

## Decisions

| Topic | Choice |
|---|---|
| Invitee never used the bot | Send the invite anyway. First reply or reaction creates the User and processes accept/reject. |
| Reverse contact | On accept, create the other direction automatically using the inviter’s stored `User.name`. Tell the invitee that name in the accept message. |
| `listar` | Numbered list = reminders the user **owns**. Below, unnumbered readonly = reminders they created for others. `apagar N` only uses the numbered list. |
| Free-tier 5 pending | Counts against the **scheduler** (`createdByPhoneNumber`), including reminders created for others. |
| Bare `sim` / `não` | Applies to the invitee’s **most recent** pending invite. |
| Storage | New `Contact` collection + `createdByPhoneNumber` on `Reminder`. No copy of reminder rows. |

## UX principle: always reply and orient

Applies to cadastrar, convite, aceitar/recusar, contatos, and reminders for contacts.

1. **Always send at least one WhatsApp text** on the path the user just took (plus the other party when the event affects them).
2. **Always say the next step** in the same reply (or a follow-up message): command to try, who to wait for, how to list.
3. **Never swallow an invite response.** Unknown reaction on a pending invite → ask them to use sim/não or 👍/👎. Do not ignore it.
4. **Errors explain the format or the command to use**, not only that something failed.
5. **PT-BR only** for these messages.

Reactions from the bot (⏳ ✅ ❌) stay as today; they do not replace the text reply.

## Data model

### Contact (new collection)

One document per inviter → invitee pair (not two rows for a mutual pair).

| Field | Type | Meaning |
|---|---|---|
| `inviterPhoneNumber` | string | Who sent the invite (Isabela) |
| `inviteePhoneNumber` | string | Who was invited (Victor). May not be a User yet. |
| `inviterNicknameForInvitee` | string | Name the inviter typed (`Victor`) |
| `inviteeNicknameForInviter` | string \| null | Set on accept from inviter’s `User.name` |
| `status` | `pending` \| `accepted` \| `rejected` | Invite state |
| `inviteMessageId` | string | WhatsApp id of the invite **sent to the invitee** |
| `createdAt` / `updatedAt` | dates | Mongoose timestamps |

**Rules**

- **One relationship per unordered pair of phones.** Do not create `A→B` and `B→A` as two documents. Lookup both directions before insert.
- Unique pair `(inviterPhoneNumber, inviteePhoneNumber)` still applies to the stored direction (who sent the invite).
- Re-invite after **rejected**: reopen the same document to `pending` (new `inviteMessageId`).
- If this direction is already **pending** or **accepted**: do not create a second invite; explain the current state.
- If the **reverse** is **accepted**: already contacts; tell them to use `Lembre o/a {nome} …` (do not send a new invite).
- If the **reverse** is **pending** (they were already invited): do not send a counter-invite; remind them to answer **sim** / **não** on the existing invite.
- Nickname unique **per user** among their pending+accepted contacts (cannot have two `Victor`s).
- Cannot cadastrar yourself.
- “User’s contacts”: accepted rows where they are inviter or invitee; nickname is the one **for the other person**.

**Phone identity**

Compare phones by **digits only**. Normalize cadastrar input: strip `( ) - +` and spaces; if the result is 10–11 digits, prepend `55`. Match `5531999999999` to `5531999999999@s.whatsapp.net` when the invitee first writes. Store Contact phones in a consistent digit form (country code + number, no `@s.whatsapp.net`) and normalize `User.phoneNumber` the same way at lookup time.

Unknown invitees are **not** created as User until first message or reaction. The Contact row is enough to send the invite via Evolution `sendText`. When messaging an existing User (owner notify, accept feedback), send to that User’s stored `phoneNumber`, resolved by digit match.

**Indexes**

- Unique: `{ inviterPhoneNumber: 1, inviteePhoneNumber: 1 }`
- `{ inviteePhoneNumber: 1, status: 1, updatedAt: -1 }` (latest pending for bare sim/não)
- `{ inviteMessageId: 1 }` (quoted reply and reaction)

### Reminder (existing)

Add:

| Field | Type | Meaning |
|---|---|---|
| `createdByPhoneNumber` | string | Who scheduled it |

- **Owner** remains `userPhoneNumber` (delivery, delete, delay).
- Self-reminders: `createdByPhoneNumber` equals `userPhoneNumber`.
- Existing documents without the field: treat as owner (self-reminder). New writes always set it.
- Index: `{ createdByPhoneNumber: 1, status: 1 }`.

**Quota (free 5):** `countDocuments({ createdByPhoneNumber, status: "pending" })`.

**Victor’s list**

- Numbered: `userPhoneNumber = Victor`, `status: pending` (owned, including ones others created for him).
- Unnumbered readonly: `createdByPhoneNumber = Victor`, `userPhoneNumber ≠ Victor`, `status: pending`.

## Flows

### 1. Cadastrar

**Intent:** regex, no AI. Pattern: `cadastrar pessoa <telefone> <nome>`.

Name is everything after the phone (`Victor Silva` is allowed).

**Processor order:** handle `register_contact` before reminder/help.

On success:

1. Upsert Contact `pending` (insert, or reopen after reject).
2. Send invite to Victor (must persist returned WhatsApp message id as `inviteMessageId`). Today `sendMessage` discards the API body; it must return the message id for this path.
3. If send fails: do not leave a pending row (delete or skip persist). Tell Isabela the invite could not be delivered and to check the number.
4. Tell Isabela it was sent, who must accept, and that she will get another message when he answers. Suggest the phrase she will use after accept.

### 2. Accept / reject

Handle **before** reminder/help when the message is an invite response.

**Order**

1. **Reaction** on the invite message (`inviteMessageId`). Yes: ✅ 👍 ❤️. No: ❌ 👎. Other emoji on that invite → text asking for sim/não or 👍/👎 (do not ignore).
2. **Quoted reply** to the invite with yes/no text.
3. **Bare chat** that is **only** a short accept/reject → most recent pending invite for that invitee.

Yes/no text (whole message, trimmed, case-insensitive), examples: `sim`, `s`, `aceito`, `aceitar`, `pode`, `quero`, `claro`, `yes`; `não`, `nao`, `n`, `recuso`, `recusar`, `no`. Not an accept: `Me lembre de comprar pão`, `sim, me lembre de x`.

Webhook: `extractUserData` must accept `messageType === "reactionMessage"` (still skip groups). Reaction is enough to `findOrCreateUser`. Extend `MessagePayload` so reaction key + emoji are available.

On accept: `status = accepted`, `inviteeNicknameForInviter =` inviter’s `User.name`. Message **both** people; tell Victor Isabela’s contact name and to send `Contatos`; tell Isabela she can schedule with `Lembre o Victor …`.

On reject: `status = rejected`. Message **both** people.

### 3. Contatos

**Intent:** regex (`contatos`, `meus contatos`). Always reply:

- Empty: how to cadastrar (full example).
- Accepted: nickname + phone.
- Pending invites **this user sent**: waiting line so they know to wait, not retry blindly.

### 4. Schedule for a contact

After reminder intent, load **accepted** contacts of the sender.

| Rule | Result |
|---|---|
| Message is for-me (`me lembre`, `me lembrar`, `pra mim`, …) | **Self** reminder, even if a contact name appears later |
| Else targeting a contact (`Lembre a/o {nome}`, `lembrete para a/o {nome}`, `agende para {nome}`, …) | Reminder **for that contact** |
| Else | Self reminder |

Nicknames: case-insensitive; if two match, **longest**. Targeting a name that is not an accepted contact → **do not** create a self reminder; tell them to send `Contatos` or cadastrar.

**Create**

1. Extract title/time/recurrence as today; strip the targeting phrase so the title is the task (`Passear com o cachorro`).
2. `userPhoneNumber` = owner (Isabela), `createdByPhoneNumber` = scheduler (Victor).
3. Free cap and AI extract rate limit apply to the **scheduler**.
4. Message Victor (created + para Isabela + how to `listar`).
5. Message Isabela (Victor created this for you + details + that it is hers to apagar/adiar).

v1: **one target person per message**. Recurrence and multiple tasks in one message stay as today, all for that one target.

**Fire (cron):** unchanged. Send to **owner** with the usual prefix + title. No second “Victor criou…” on delivery.

### 5. List / delete / delay

- Owned rows created by someone else: optional `· por {nickname}` on the numbered line.
- Delete: `Reminder.deleteOne` still requires `userPhoneNumber` of the sender. Creator cannot delete by `apagar N` because those rows are not in the numbered list.
- Delay: owner only, existing flow on the chat that receives the fired reminder.

## Message catalog (PT-BR)

Wording may be adjusted slightly in implementation; **intent and next-step must stay**. Names/phones are interpolated.

### Cadastrar (Isabela)

| Situation | Message must include |
|---|---|
| Success | Invite sent to **Victor**; she will be notified; after he accepts she can use `Lembre o Victor …`; `Contatos` to see the list |
| Bad phone / missing name | Example: `Cadastrar pessoa (31)999999999 Victor` |
| Self | Cannot cadastrar yourself |
| Duplicate nickname | That name is already a contact; `Contatos` |
| Already pending | Waiting for **Victor**; no second invite |
| Reverse pending (Victor already invited her) | He already sent her an invite; she should answer sim/não (quote the example) |
| Already accepted (either direction) | Already a contact; example `Lembre o Victor …` |
| Send failed | Could not deliver; check DDD/number; try again |

### Invite (Victor)

`{Isabela} quer te cadastrar como um contato para agendar lembretes, deseja aceitar?`  
Orient: reply **sim** or **não**, or react 👍 / 👎.

### Accept / reject

| Who | Yes | No |
|---|---|---|
| Victor | Ótimo; they can schedule for each other; **Isabela** is in his contacts; send `Contatos`; example `Lembre a Isabela …` | Ok, recusou o convite para ser contato da **Isabela** |
| Isabela | **Victor** aceitou; they can schedule; example `Lembre o Victor …` | **Victor** recusou o convite para ser seu contato |

Unknown reaction on the invite (Victor): did not understand; use sim/não or 👍/👎.

### Contatos

Empty: no contacts yet + cadastrar example.  
Non-empty: accepted list; pending sent invites as “aguardando resposta”; hint `Lembre a {nome} …`.

### Reminder for a contact

| Who | Content |
|---|---|
| Creator | Same created confirmation as today + **para {nome}** + `listar` shows it as somente leitura |
| Owner | `{Creator} criou um lembrete para você: *{title}* — {when}` + it is theirs to `apagar` / `adiar` |
| Name not a contact | Not found; `Contatos` or cadastrar |
| Scheduler at free cap / AI limit | Existing premium / rate-limit messages (still send those texts) |

### Listar (extra block)

If there are created-for-others rows, after the numbered owned list:

```
📤 *Agendados para outros* (somente leitura)
• *{title}* — para {nome} — {when}
```

If the user owns nothing but has created-for-others: do not use the generic empty-only copy; say they have no own pending reminders, then the readonly block, and how to `apagar` own ones after `listar` when they exist.

## Pipeline

```
WhatsApp → Evolution → POST /
  extractUserData (conversation + reactionMessage; find-or-create User)
  processMessage
    regex: cadastrar / contatos / yes-no / existing intents
    pending-invite: reaction → quoted reply → latest pending
    reminder → resolve target contact → scheduleReminder
```

**New / changed**

- `src/domain/contacts/` — model, phone normalize, cadastrar, accept/reject, list
- Intents `register_contact`, `list_contacts`; Gemini classify prompt updated so cadastrar/contatos are not classified as `help`
- Middleware + `MessagePayload` for reactions
- `sendMessage` returns WhatsApp message id
- `Reminder.createdByPhoneNumber`; quota + list queries
- Help messages: cadastrar, contatos, `Lembre a {nome} …`
- `product.md` updated in implementation to match this spec

## Error handling

| Case | Behavior |
|---|---|
| Invalid cadastrar parse | Format example (always) |
| Self / duplicate nickname / pending / accepted | State + next step (always) |
| Invite send fails | No pending row; Isabela told |
| Unknown emoji on **pending invite** | Ask for sim/não or 👍/👎 |
| Reaction on some other message | Ignore (not an invite response); no extra ping |
| Target name not a contact | No self reminder; Contatos / cadastrar |
| Owner User missing at schedule (should not happen after accept) | Fail; tell scheduler to ask the person to message the bot |
| Free cap / AI limit | Existing messages to the scheduler |

## Tests (no live WhatsApp)

- Phone normalize: `(31)999999999` → `5531999999999`; JID vs digits match
- Cadastrar: success, self, duplicate nickname, pending, accepted, reverse pending, reverse accepted, reopen after reject, send failure leaves no pending
- Accept/reject: reaction, quoted reply, bare sim = latest pending; `me lembre…` does not accept; unknown invite reaction sends guidance
- Both parties receive accept/reject texts
- Schedule: `Lembre a Isabela…` vs `Me lembre de ligar para a Isabela`; quota on `createdBy`; owner + creator both messaged
- List: numbered owned + unnumbered created-for-others; empty owned + readonly still sends a message
- Delete: owner can; creator `apagar N` cannot remove the owner’s row

## Out of scope (v1)

- Remove or rename contact
- Creator deleting or delaying the owner’s reminder
- Notify creator when the owner deletes or when the reminder fires
- Several target people in one message
- Non-Brazilian numbers without an explicit country code

## Approach

**Contacts collection + `createdBy` on Reminder** (chosen). Single source of truth for reminder state; Contact is only the relationship/invite.
