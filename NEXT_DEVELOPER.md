# Start Here — Next Developer Orientation

Practical orientation for picking this project up. For **accumulated operating rules and environment gotchas** (dev-server quirks, the local network flake, fixture discipline, live-schema reference tables), read **[HANDOFF.md](./HANDOFF.md)** — this document does not repeat them.

Last updated: 30 July 2026.

---

## 1. Quick orientation

**Stack:** Next.js 15.2.4 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (PostgreSQL + Auth + Storage).

**Run it locally:**
```bash
cd smart-city-elearning/smart-city-elearning
npm install
cp .env.example .env.local     # then fill in the three Supabase values
npm run dev                    # http://localhost:3000
```
`.env.local` needs exactly three variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Leave the dev server running while you edit — it hot-reloads. Only a *production* server (`npm start`) must be stopped before editing, since its build artifacts otherwise mask your changes.

### Where to start reading

| To understand… | Read |
|---|---|
| Who can do what, and how it's enforced | `middleware.ts`, then `supabase/migrations/002_rls_policies.sql` |
| The database as it actually is | `supabase/migrations/` in order — later files correct earlier ones |
| How a typical admin CRUD screen is built | `components/admin/event-form-dialog.tsx` + `events-management-view.tsx` (the cleanest example; learning paths and courses follow the same shape) |
| How identity reaches the UI | `components/providers/user-provider.tsx` |

### Two conventions worth knowing immediately

**Authorization lives in the database.** Every table has Row Level Security. `middleware.ts` gates routes server-side, and RLS is the authoritative check underneath. The client-side user context is **display state only** — never treat it as an access-control input.

**Admin write paths follow one pattern.** Controlled shadcn dialog → `useState` per field with inline validation (no form library) → write via `supabaseBrowser` through RLS → `recordAdminAction(...)` for the audit log → revalidate + `router.refresh()`. Match it rather than inventing a new approach.

---

## 2. What's fully built and working

**Authentication & roles** — email/password sign-in, registration with organization type and Region 02 location, three roles (learner / instructor / admin) enforced in middleware and RLS. **Self-service password reset** (`/forgot-password` → emailed link → `/reset-password`): the reset page handles both token formats Supabase can deliver — implicit `#access_token` via `setSession()` and PKCE `?code=` via `exchangeCodeForSession()` — so it works regardless of which email template or link source produced the link. The request screen returns an identical message for known and unknown addresses (no user enumeration), and tokens are single-use.

**Learner** — course catalogue with debounced search and filters (server-rendered, cached), course detail with prerequisite gating, PDF module reader with page-marked lessons, progress tracking, certificates with public verification, personal dashboard, Team Progress for organization members, events listing.

**Instructor** — dedicated workspace, module authoring against an embedded PDF viewer, standalone (unassigned) module creation, draft → submit → approved/rejected workflow with edit-lock during review, edit-and-resubmit on rejection, in-app notifications.

**Admin** — content review queue with approve/reject (written reason required), course management, user management (approve / suspend / reactivate), module-to-course assignment with override logging, events CRUD, learning paths CRUD with course ordering, analytics dashboard, activity log.

**Platform** — trigger-driven in-app notifications with an unread bell, admin audit trail, organization registry linked to user accounts, admin-toggleable settings (`app_settings`).

**Database** — 16 tables, 18 migrations, RLS on everything, prerequisite enforcement inside the enrolment RPC, storage policies scoped to module ownership.

---

## 3. What's missing or deferred, and why

| Item | State | Why |
|---|---|---|
| **Email confirmation** | Off | Deliberate. Needs an SMTP provider and a decision on who operates it. The registration flow **already handles the confirmed-email path correctly** (`register-form.tsx` detects a user returned without a session and directs them to their inbox) — flipping it on in Supabase Auth should require no code change |
| **Terms of Service / Privacy Policy** | Links exist, inert | Deliberate. Needs real legal text from the SSCP program, especially on participant data handling. Not something a developer should author. Wire the links once text exists |
| **Password-reset email volume** | Works, but throttled | Uses Supabase's **built-in mailer**, which sends fine today — verified live, including that it still works with signup confirmation off (`mailer_autoconfirm: true` governs signup only; recovery is a separate template). It is aggressively rate-limited, though: a second request seconds later returns `over_email_send_rate_limit`. Fine for occasional resets, not for volume. Configure custom SMTP in the Supabase dashboard if that changes — **no code change needed** |
| **Storing notification / privacy preferences** | Not built | The 8 switches in `profile-settings.tsx` are now genuinely `disabled` (verified with a forced click — `data-state` does not change), with `defaultChecked` removed so none falsely shows "on", and a "Not yet available" note on each tab. The notes state real current behaviour — in-app notifications still arrive via the bell, and certificates remain publicly verifiable — so a switched-off toggle isn't read as a broken feature. Backing them with a `user_preferences` table is the remaining work |
| **"Change Password" button** | Disabled, but now easy | Sits in the Privacy tab's Account Security block. A working reset flow exists at `/forgot-password`, so this is a small wiring job — either link to it, or call `resetPasswordForEmail` for the signed-in user's own address. Distinct from the preference-toggle work above |
| **Two placeholder learning paths** | Shown, labelled | The ~18 courses they list do not exist — each was checked against the catalogue individually (0 exact matches, no close equivalents). Hardcoded in `learning-paths-dashboard.tsx` and `learning-path-grid.tsx`, gated behind the `show_placeholder_learning_paths` setting and disclosed in the admin UI. Delete both arrays once real paths replace them |
| **Learner Analytics / Organization / Help Center** | Greyed in sidebar | Never built. Correctly disabled rather than linking to nothing — the routes genuinely do not exist |
| **`images.unoptimized`** | Resolved | Optimization is enabled; noted here only because older notes in HANDOFF.md describe it as outstanding |

---

## 4. Recommended next steps

The three items that used to head this list — password reset, the misleading preference toggles, and the dead "Invite Team Members" button — are **done**. What follows is what actually remains.

**High value, low effort**
1. **Wire the "Change Password" button** to the reset flow at `/forgot-password`. The last disabled control with a working counterpart already behind it

**Needs input from the program, not code**
2. Terms of Service and Privacy Policy text
3. The email-confirmation / SMTP decision — the same decision that lifts the password-reset rate limit

**Larger**
4. **Author real content** — the platform's biggest gap is courses, not features. Once real learning paths exist, delete the two placeholder arrays and the `app_settings` toggle that hides them
5. **Store real notification and privacy preferences** (`user_preferences` table), then enable the switches that are currently disabled
6. **Build the deferred learner screens** (Analytics, Organization, Help Center) if they're actually wanted — verify the need before building; they've been greyed out since the original prototype
7. **Consider tightening `learningpath_courses` writes further** — reads now follow the parent's status (018), and writes are admin-only, so this is a consistency nicety rather than a live risk

---

## 5. ⚠️ The one warning that matters most

**Always verify the live database against the migration files before trusting either.**

This is not a general caution — it is the single most repeated problem in this project's history. **On seven separate occasions** the live database disagreed with the repository:

- Eight undocumented policies on `users`, several of them actual vulnerabilities (→ migration 003)
- A trigger existed in production that no migration created (→ 005)
- A column was named differently live than in the schema file (→ 006)
- A declared uniqueness constraint had never been applied, permitting duplicate enrolments (→ 007)
- Nine undocumented policies on `modules`/`lessons`/`resources` — three let any authenticated user insert, update or delete any lesson platform-wide (→ 008)
- Three undocumented storage policies on the course-materials bucket. A fourth *was* documented but lied in its name: `course_materials_enrolled_read` never checked enrolment (→ 011)
- Eight more undocumented policies across the two learning-path tables — including a read leak and a bug letting demoted admins keep edit rights forever (→ 018)

**28 undocumented policies removed in total.** A policy's existence in a migration file proves nothing about production, and a policy's *name* proves nothing about what it does.

Column *types* drift too: `organizations.type` is plain `text` live despite `001` declaring an enum, and a function declaring the enum return type fails outright.

**Before writing any migration or RLS-dependent feature:**

```sql
-- What policies actually exist on this table?
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'your_table';

-- What does a constraint actually say?
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'your_constraint';
```

And confirm behaviour empirically with a real non-admin session, not just by reading policy text. Finding 9 (archived paths readable by anyone) was caught **only** because a feature test exercised the actual behaviour rather than trusting the policy the migration file declared. A `DROP … / CREATE …` on the correct policy would not have fixed it — a second, undocumented permissive policy was ORing straight back in.

Postgres combines permissive policies with OR. **One stray policy defeats every correct one on the table.**

---

## Quick reference

```
app/                    routes (30 pages, 6 API routes)
components/admin/       admin screens + form dialogs
components/instructor/  instructor workspace
components/dashboard/   learner dashboard
components/providers/   user-provider.tsx — shared identity context
lib/supabase/           browser / server / public / admin clients (pick deliberately)
lib/database/           queries.ts (server) · client-queries.ts (browser)
supabase/migrations/    001–018, apply in order
middleware.ts           route gating — the authoritative server-side check
HANDOFF.md              operating rules, environment gotchas, live-schema notes
PROJECT_SUMMARY.md      what was done and why (presentation-facing)
```

**Supabase client selection matters:** `supabaseBrowser` (client components) · `supabaseServer` (server components, reads cookies — makes a route dynamic) · `supabasePublic` (cookie-free, for cacheable public pages — using the wrong one silently disables ISR) · `admin-client` (service role; server-only, never expose).
