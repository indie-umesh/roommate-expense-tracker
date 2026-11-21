# PROJECT BRIEF — Roommate Expense Tracker

> Read this whole file before writing any code. It is the single source of truth for scope, stack, data model, and working rules. If something here conflicts with your assumptions, follow this file. If something is missing or blocks you, stop and ask instead of guessing.

---

## 1. Context (why this exists)

I (Umesh, full-stack web developer, Indore, India) live in a shared room with two roommates: **Aman** and **Ritesh**. Our paydays fall on different dates of the month: **Ritesh on the 1st, Aman on the 5th, Umesh on the 15th**. Because of that, for most of the month we cover each other's expenses (rent, groceries, bills, food, etc.) and settle later.

We tried tracking this in a Google Sheet. It failed: expenses were not logged at the moment they happened, and the month-end reconstruction was too complex. The root cause was **entry friction**, not the math.

So this is a tool I am building **first for myself and my two roommates**, then putting live publicly to see if it ranks/gets organic use. The target search keyword is **"roommate expense tracker"** (small volume; do not expect SEO traffic; do not over-invest in the marketing site).

### The one design principle
**Adding an expense must take ≤ 3 taps and under 10 seconds on a phone.** If a feature makes that slower, it does not belong in v1.

### Success test (the only metric that matters for v1)
All three of us use it for one full month (December 2026), and the month-end settlement takes **under 5 minutes**. If this fails, the product has failed regardless of how clean the code is.

---

## 2. Scope

### v1 (build this)
- Login with **mobile number + 6-digit security PIN** (no email, no OTP/SMS).
- Create a group, join via **invite code/link**, add members (including members who have not signed up yet).
- Add expense: **amount, details, paid by, split among (who shares it)**, date.
- List/edit/delete expenses (soft delete, visible "edited" marker).
- **Balances screen**: always shows who owes whom and how much, at any moment.
- **Settle up**: record real payments between members; "reset" is done by recording settlements/checkpoints, never by deleting data.
- Installable PWA, mobile-first.

### v2 (after v1 works for us)
- **Excel-style sheet view** (rows = expenses; columns = each member's share; paid-by; totals; net balance row), filterable by date/checkpoint.
- **Export to Excel (.xlsx) and PDF**, generated client-side.

### v3 (optional)
- **Payday-aware settle view**: members have a payday day-of-month; show "Ritesh settles on 1st: ₹X, Aman on 5th: ₹Y".
- Self-serve PIN reset approved by another group member.
- Marketing site in **Astro** (separate project, built LAST).

### Explicitly out of scope for v1 (do not build, do not scaffold)
SMS/WhatsApp OTP, payment/UPI integrations, multi-currency, receipt scanning/photos, push notifications, offline sync, charts, categories/tags, Splitwise import, admin panel, unequal/percentage split UI (schema must support it later; UI is equal split only), the Astro marketing site.

---

## 3. Decided stack

| Layer | Choice |
|---|---|
| App | **Vite + React + TypeScript (strict)** SPA |
| Styling | **Tailwind CSS**, mobile-first |
| Routing | React Router |
| Server state | TanStack Query |
| Backend/DB/Auth | **Supabase** (Postgres + Auth + RLS), `@supabase/supabase-js` in the browser with the **publishable (anon) key only**. Never ship the service-role key to the client. |
| Hosting | **Cloudflare** (static assets, SPA fallback) at `app.roommatesexpensemanager.com` |
| Marketing site (later) | **Astro** at `roommatesexpensemanager.com` — separate project/folder, built last |
| v2 libs | TanStack Table (sheet view), SheetJS or ExcelJS (xlsx), jsPDF + jspdf-autotable (PDF) — all client-side |
| Tests | Vitest for pure logic; SQL/RLS verification script with two test users |

Notes:
- **No Next.js** (Cloudflare's Next.js story is in flux, and the app needs no SSR/SEO).
- **No server-side PDF/Excel generation.** Do it in the browser.
- No server code of our own in v1: invariants live in Postgres (constraints, RPC functions, RLS).
- Dev machine may be Windows: use cross-platform npm scripts, avoid bash-only tooling. Use a **hosted Supabase dev project** (no Docker requirement); keep all schema changes as SQL files in `supabase/migrations/` and apply them with the Supabase CLI.
- **Verify against current official docs** for Supabase Auth (phone + password) and Cloudflare static-asset hosting before relying on memory. These change.

Suggested repo layout (single repo, separate deployables):
```
/app        Vite React SPA (build this now)
/site       Astro marketing site (later; leave empty or absent now)
/supabase   migrations, seed, SQL tests
PROJECT_BRIEF.md
```

---

## 4. Auth design: mobile number + PIN

- Use **Supabase phone + password sign-in with phone confirmation DISABLED** (no SMS provider, no OTP). Phone number = username, **6-digit numeric PIN = password**.
- UI accepts a 10-digit Indian mobile number and normalizes to E.164 (`+91XXXXXXXXXX`). PIN input: numeric keypad, exactly 6 digits, confirm-PIN field on signup.
- Check Supabase's minimum password length setting is compatible with a 6-digit PIN.
- **Phone numbers are unverified**, so a phone number must NEVER grant access to any data. **Access to a group happens only through the invite code** (membership row). RLS is based on `auth.uid()` membership, never on phone number.
- If phone+password cannot be enabled without an SMS provider on the current Supabase version, **stop and tell me**, with a proposed fallback (e.g., synthetic email identifier). Do not silently pick a hack.
- v1: **no self-serve PIN reset.** Umesh resets PINs from the Supabase dashboard. Design the schema so group-member-approved reset can be added in v3.
- Before going public (not needed for the 3 of us): confirm rate limiting settings, and add per-account lockout if Supabase does not provide it.

---

## 5. Data model

**Money rule: all amounts are integer paise (`bigint`). Never floats/numerics for money in app code.** Format only at display time using `en-IN` locale (e.g., ₹1,23,456.00).

All tables: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`. **RLS enabled on every table, no exceptions.**

- **profiles**: `id` (= `auth.users.id`), `phone`, `display_name`.
- **groups**: `name`, `invite_code` (unique, short, hard to guess), `created_by`.
- **members**: `group_id`, `user_id` (**nullable**), `display_name`, `role` (`admin|member`), `payday_day smallint null` (1–31, for v3), unique `(group_id, user_id)`. A member row with null `user_id` is a "ghost" (someone I add by name before they sign up); they claim it when joining.
- **expenses**: `group_id`, `paid_by_member_id`, `amount_paise bigint check (>0)`, `details text`, `spent_on date default current_date`, `created_by`, `updated_at`, `deleted_at` (soft delete).
- **expense_splits**: `expense_id`, `member_id`, `share_paise bigint check (>=0)`, pk `(expense_id, member_id)`. **Invariant: sum of shares = expense amount**, enforced in the DB (trigger or by only allowing writes through the RPC below).
- **settlements**: `group_id`, `from_member_id`, `to_member_id`, `amount_paise bigint check (>0)`, `settled_on date`, `note`, `created_by`, `deleted_at`. Meaning: "from paid to".
- **checkpoints**: `group_id`, `created_by`, `note`. A marker "we settled everything up to here". Sheet/reports can filter from the last checkpoint. **Nothing is ever deleted to "reset".**
- (Phase 4) **expense_audit**: trigger-populated history of edits/deletes (who, when, old values).

### RPC functions (SQL, `security definer`, with explicit `set search_path`)
- `create_expense(group_id, paid_by_member_id, amount_paise, details, spent_on, participant_member_ids uuid[])`: inserts the expense + splits **atomically**, doing the equal split server-side.
- `update_expense(...)` with the same split logic; sets `updated_at`.
- `join_group(invite_code, claim_member_id uuid null)`: adds the caller as a member, or links them to an existing ghost member. Never expose a table listing that lets someone enumerate groups/invite codes.
- `is_group_member(group_id) returns boolean` helper used by RLS policies.

### Equal split rule
`base = floor(amount / n)`, `remainder = amount - base*n`; give `+1 paise` to the first `remainder` participants in a deterministic order (e.g., by member id). Shares must sum exactly to the amount. Example: ₹100.00 among 3 → 3334 / 3333 / 3333 paise.

### Balances
Per member (ignoring soft-deleted rows):
```
net = Σ(expenses paid) − Σ(own shares) + Σ(settlements paid out) − Σ(settlements received)
```
Positive net = the group owes this member. Net balances across a group must always sum to **zero**. Expose as a SQL view `member_balances`. "Who pays whom" is derived **client-side** with a greedy min-transfers simplification (largest debtor ↔ largest creditor), and is a pure, unit-tested function.

### RLS rules (summary)
- Read/write any row only if `is_group_member(group_id)` for the caller (join through expense → group for splits).
- Insert on members/groups only through the RPCs/controlled policies.
- A non-member must get **zero rows** and **no ability to write**. Verify with two real test users in a SQL/test script (not just by eye).

---

## 6. v1 screens and UX

Mobile-first, big tap targets, minimal chrome, fast. Language: **simple English UI** (keep strings in one place so they can be localized later).

1. **Login / Sign up**: mobile number + PIN (+ confirm on signup, + display name).
2. **Groups**: list, create, **join with invite code** (with an optional "I am this existing member" picker for ghost members).
3. **Group home**: top card with balances in plain words ("Ritesh owes Umesh ₹1,250"); recent expenses; a prominent **"Add expense"** button.
4. **Add expense** (the critical screen):
   - Amount first, numeric keypad auto-opens.
   - Details (single line).
   - **Paid by**: default = me.
   - **Split among**: member chips, **default = everyone selected**; tap to toggle.
   - Date: default today.
   - One "Save" button; optimistic UI; return to home. Target: 3 taps after typing amount/details.
5. **Expense detail**: edit, delete (soft), shows "edited" marker and who added it.
6. **Settle up**: shows the simplified transfers; "Mark as paid" creates a settlement; optional "Create checkpoint".
7. **Members**: share invite link/code via WhatsApp share intent, add ghost member by name.

PWA: web manifest + icons + installable (use `vite-plugin-pwa` or equivalent). No offline data sync in v1. Add `noindex` to the app.

---

## 7. Engineering rules

- TypeScript `strict`; ESLint + Prettier; no `any` without a comment.
- Pure functions (split calculation, balance math, debt simplification, INR formatting) live in a `lib/` module with **Vitest tests**.
- Required test cases: 100.00 split among 3; amount not divisible evenly; single participant; participants subset of group; balances sum to zero after random expense/settlement sequences; soft-deleted expense removed from balances; settlement zeroes a pair.
- Migrations only through `supabase/migrations/*.sql`. No manual dashboard schema edits that aren't captured in a migration.
- Secrets: only the publishable key in the client via env vars; `.env.example` committed, real `.env` ignored.
- Handle loading/error/empty states on every screen. Basic accessibility (labels, focus, contrast).
- Keep dependencies small. Ask before adding a heavy library.

---

## 8. Deployment

- Build static (`vite build` → `dist/`) and deploy to **Cloudflare** as static assets with **SPA fallback** (all unknown paths serve `index.html`). Confirm the exact current config in Cloudflare docs.
- Domain: `app.roommatesexpensemanager.com` for the app. The root domain is reserved for the future Astro site.
- Supabase **free plan pauses projects with very low activity** over a week; fine for daily use by three people, but remind me to export data regularly (v2 Excel export doubles as backup).

---

## 9. Phases and acceptance criteria

Work phase by phase. After each phase: run typecheck, lint, tests; summarize what is done, what is next, and any decision you made that I should review.

**Phase 0 — Scaffold**: repo layout, Vite + React + TS + Tailwind, ESLint/Prettier, Vitest, env handling, Supabase client, routing shell, PWA manifest.
*Done when*: app runs locally, builds, deploys-ready.

**Phase 1 — Schema + auth + groups**: migrations for all tables, RLS, RPCs, `member_balances` view; phone+PIN signup/login; create/join group via invite code; ghost members.
*Done when*: two test users prove a non-member cannot read/write another group's data; signup/login works with phone + 6-digit PIN.

**Phase 2 — Expenses + balances**: Add/edit/delete expense, equal split via RPC, balances screen, simplified transfers, settle-up with settlements and checkpoints.
*Done when*: acceptance tests in section 7 pass; adding an expense takes ≤ 3 taps after amount/details; balances always sum to zero.

**Phase 3 — Hardening for real use**: edit/delete markers, audit table, empty/error states, PWA polish, deploy to Cloudflare, seed the real group (Umesh, Aman, Ritesh).
*Done when*: the three of us can use it on our phones.

**Phase 4 (v2) — Sheet view + exports**: Excel-style matrix view and client-side .xlsx/.pdf export.

**Phase 5 (v3, optional)**: payday-aware settle view, PIN reset by group approval, then the Astro marketing site.

---

## 10. How I want you to work

1. Start by replying with a **short plan (≤ 15 lines)** for Phase 0 and Phase 1, listing any questions that truly block you. Then proceed; don't wait for approval unless blocked.
2. **Do not expand scope.** If you think a feature is missing, list it at the end instead of building it.
3. Make small, reviewable commits with clear messages.
4. When you rely on an external service's behavior (Supabase Auth, Cloudflare config), check the current official docs and say what you verified.
5. When you make a decision that wasn't specified here, record it in a `DECISIONS.md` (one line each).
6. Prefer boring, simple solutions. This is a tool for three people first.
