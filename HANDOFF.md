# Project Handoff — Cagayan Valley Smart City Academy

E-learning platform (Next.js 15 / React 19 / TypeScript / Tailwind / shadcn-ui, Supabase Postgres+Auth+Storage) for DOST Region 02's Smart & Sustainable Communities Program. Live at `https://sscacademy.dost02onedata.com`.

This document is the durable record of project state as of the end of the prerequisite-enforcement work. It does not depend on any assistant memory — everything needed to continue is here or in git history.

---

## Critical operating rules (read first)

1. **Destructive-op check-first (live data).** Before ANY `DELETE`/`TRUNCATE`/overwriting `UPDATE` on live `users`/`courses`/`enrollments`/`certificates`: first run the identical filter as a `SELECT`/`count(*)`, show the exact rows, get explicit confirmation, THEN run the destructive statement. **Exact id/value match only — never `LIKE`/wildcards/substring for destructive ops.** (SELECTs may use patterns to *identify*; deletes must be exact-id.)
2. **Course data is the highest-priority thing never to lose.** User-account loss is recoverable/tolerable; course + course-content (modules/lessons/resources) loss is not. This rule exists because a substring `email LIKE '%or%'` delete once removed a real user (`lacortehavilla@gmail.com`); recovered only because they had no enrollments.
3. **Migrations/RLS/DB DDL:** the assistant cannot reach `pg_catalog`/`information_schema`/SQL-editor/Auth-settings — those are dashboard-only. The user runs migrations and catalog queries and pastes results. The assistant reads/writes only `public`-schema **data** via PostgREST (anon + service-role keys in `.env.local`).
4. **Node `fetch` (undici) is flaky here** — it times out on IPv6 to Supabase on this Windows box. Not a real outage; `curl -m 15` to the same endpoint responds in <1s. Use curl for DB checks when scripts report "fetch failed".
5. **Dev server:** after any `npm run build && npm run start` verification, switch back to `npm run dev` before further edits (don't leave stale `.next` prod artifacts around).

---

## Live schema reality (differs from migration files — confirmed drift)

The live DB was **not** built from `001_initial_schema.sql`. Build new schema against live idioms:

- **No enums for most columns.** `courses.level`, `enrollments.status`, `resources.type`, `lessons.type` are `text` + `CHECK`, not enums. Only `user_status` (users.status) and `enrollment_status` exist as enums, and even `enrollments.status` uses text+check, not the enum.
- **UUID default: two conventions by table lineage (intentional, not drift).** Most `public` tables default `uuid_generate_v4()` (uuid-ossp). The system-write tables `certificates`, `admin_logs`, and `notifications` (014) default `gen_random_uuid()`. Match the lineage of the table you're touching.
- **`organizations.type` is `text`** in live, not the `organization_type` enum `001` declares. A function returning it must declare `text` or it fails with a result-type mismatch. (`users.status` genuinely IS the `public.user_status` enum.)
- **SECURITY DEFINER safety comes from the function's own logic, not from GRANTs.** Postgres grants `EXECUTE` to `PUBLIC` by default, so any such function is callable by `anon` whether or not it was granted to `anon` — verified live (an anon session calls `suggest_course_titles` and gets the same rows as service role). Every function must therefore be safe on its own terms when `auth.uid()` is NULL; never rely on GRANT/REVOKE as the access control.
- **NOT NULL without defaults** on `courses.description/category/thumbnail/instructor/target_audience` — inserts must supply them (else `23502`).
- **FKs are nullable** on `modules.course_id`, `lessons.module_id`, `resources.module_id`, `enrollments.user_id/course_id`. All FKs are `ON DELETE CASCADE`.
- **`courses.rating` = float8**, **`enrollments.grade` = int4** (not the numeric types in `001`).
- **`lessons_type_check` = ('video','text','quiz','assignment')** — **`'pdf'` is NOT valid and never was.**
- **`resources.type` CHECK = ('pdf','video','link','document')**.

### Known live columns (check this BEFORE writing any fixture INSERT)

Built from prior schema dumps plus trial-and-error. **Living reference — correct and extend it whenever a future fixture or dump reveals something new.** Do not guess column names/types; guessing is what produced this list the hard way.

- **users:** `id`, `email`, `name` (**not** `full_name`), `user_type` (NOT NULL, no default), `region` (NOT NULL, no default), `organization`, `position`, `province`, `city`, `avatar`, `is_admin`, `is_instructor`, `status`, `created_at`, `updated_at`
- **courses:** `id`, `title`, `description` (NOT NULL, no default), `category` (NOT NULL, no default), `level` (NOT NULL, CHECK `beginner`/`intermediate`/`advanced`, no default), `duration` (NOT NULL int, no default), `target_audience` (**text[]**, NOT NULL — use `ARRAY['x']`, not a bare string), `prerequisites` (text[], nullable), `thumbnail` (NOT NULL, no default), `instructor` (NOT NULL text, no default), `instructor_id` (nullable FK), `rating`, `skills` (text[]), `enrollment_count`, `is_active`, `created_at`, `updated_at`
- **modules:** `id`, `course_id`, `title`, `description` (NOT NULL, no default), `"order"` (**reserved word — must be quoted**, NOT NULL, no default), `estimated_duration` (NOT NULL, no default), `is_required`, `status`, `submitted_by`, `reviewed_by`, `reviewed_at`, `review_notes`, `submitted_at`
- **lessons:** `id`, `module_id`, `title`, `type` (CHECK `video`/`text`/`quiz`/`assignment` — **not** `pdf`), `"order"`, `duration`, `start_page`
- **resources:** `id`, `module_id`, `type` (CHECK `pdf`/`video`/`link`/`document`), `path`

### Content model (how PDFs are structured — match this exactly)
A module has **one `resources` row** (`type='pdf'`, `module_id` FK) — the uploaded PDF — plus **lessons rows** (`type='text'`, 100% of the 189 live lessons) that act as section markers, each with a `start_page` into that PDF. Never create a `type='pdf'` lesson. PDFs render client-side via `react-pdf`/pdfjs (see `components/courses/pdf-viewer.tsx`), signed URL fetched directly from Supabase Storage (`course-materials` bucket, 24h expiry) — no third-party proxy.

---

## What's done (all committed on branch `fixing-qa-bugs`)

### Security remediation (was a live, exploitable state)
- **Login auth-bypass** fixed: failed user-type gate now `signOut()`s (was leaving a live session).
- **Middleware** uses `getUser()` (revalidates) not `getSession()` — revoked sessions are now rejected.
- **Certificate IDOR** closed: download route enforces owner-or-admin (403); public verify moved to `GET /api/certificates/verify/[id]` (service-role, returns only name/course/date + valid/revoked/not_found — no grade/PII).
- **RLS audit + fixes (migrations 003/004):** removed out-of-VC dashboard policies that leaked the entire `users` table (PII + `is_admin`) to anon, allowed `is_admin` self-escalation (insert AND update paths), allowed any authenticated user to update any course, and let cert owners tamper/delete their own certs. Also removed the certificate `status='active'` public carve-out (verify now goes through the server route).
- **Registration:** removed dead anon duplicate-email pre-check (rely on `signUp()` error); added "check your email" branch for the confirmation-ON case (see caveat below); fixed org-field wipe on province change.
- **PDF viewer:** replaced Google Docs Viewer iframe (which leaked the private signed URL to Google) with client-side `react-pdf`; fixed the `DOMMatrix` SSR crash via `dynamic(..., { ssr: false })`.

### Migrations (all applied to live AND committed)
| File | Purpose |
|---|---|
| `003_tighten_rls_from_audit.sql` | drop rogue policies; close users PII leak, is_admin escalation, loose course grants, cert tamper |
| `004_tighten_certificate_rls.sql` | remove active-cert public read carve-out (owner/admin only) |
| `005_capture_enrollment_count_trigger.sql` | capture the live `update_enrollment_count` trigger into VC |
| `006` (learningpath_id) | reconcile `learningpath_courses.learningpath_id` naming drift |
| `007_enrollments_unique_user_course.sql` | add missing `UNIQUE(user_id, course_id)` (prevents dup enrollments/double-count) |
| `008_phase3_instructor_content_workflow.sql` | instructor role + workflow (see below) |
| `009_lock_review_edits_and_submitted_at.sql` | `modules.submitted_at`; `modules_instructor_update` USING now also requires current status `draft`/`rejected` — instructor cannot edit a module under review (and cannot self-withdraw a submission; admin-only). WITH CHECK unchanged from 008. |
| `010_instructor_delete_own_draft_content.sql` | instructor DELETE on `lessons`+`resources`, scoped to own course AND module status `draft`/`rejected`. 008 gave instructors no delete, so the module editor's delete-then-reinsert save silently no-op'd the delete under RLS and **duplicated** the lesson list. Editor also hardened: it counts rows after the delete and refuses to write if any survive. |
| `011_tighten_course_materials_storage.sql` | close the `course-materials` storage hole. Replaced 3 permissive SELECT policies (any authenticated user could read ANY object) with one mirroring `resources_enrolled_read`, keyed off the path's module id `(storage.foldername(name))[4]`. Replaced the loose INSERT (any authenticated user could upload) with owner-scoped INSERT+UPDATE, frozen to module status `draft`/`rejected` (review-freeze, same as 009). Bucket: `file_size_limit=52428800` (50MB), `allowed_mime_types={application/pdf}`. |

### Migration 008 — Phase 3 schema foundation (applied)
- `users.is_instructor` bool + `is_instructor()` helper (mirrors `is_admin()`: sql/STABLE/SECURITY DEFINER/search_path=public).
- `courses.instructor_id` uuid FK → users (ON DELETE SET NULL).
- `modules` review state: `status` text CHECK('draft','pending_review','published','rejected') — existing 23 modules backfilled to `'published'`, default flipped to `'draft'` for new rows — plus `submitted_by`, `reviewed_by`, `reviewed_at`, `review_notes`.
- **Status-aware read RLS** on modules/lessons/resources: non-owner sees only `published` modules of active courses; admin sees all; instructor-owner sees all their own regardless of status. (`resources` enrolled-read also requires enrollment `status IN ('active','completed')`.)
- **Instructor write RLS** (insert/update, no delete): `is_instructor() AND is_active_user() AND course.instructor_id = auth.uid()`. Instructors CANNOT set module status to `published`/`rejected` (WITH CHECK restricts them to draft/pending_review) — only admins publish/reject via the existing `*_admin_write` policies.
- **`get_unmet_prerequisites(p_course_id uuid) returns text[]`** — single source of truth. Uses `auth.uid()` internally. Matches prerequisites (text[] of titles) against live courses by case-insensitive trimmed exact title; returns titles the user hasn't completed; titles with no matching live course are ignored (never block).
- **`suggest_course_titles(text, real)`** + `pg_trgm` — fuzzy "did you mean" for title inputs. Suggestion only, never enforcement.

### Prerequisite enforcement (committed `c878e8a`)
Wired `get_unmet_prerequisites()` into all three points — no duplicated logic:
1. **Enroll** (`course-header.tsx`): re-checks before enrolling, shows unmet titles; distinct "no published content yet" message for zero-published-modules courses.
2. **Course detail** (`app/courses/[id]/page.tsx`): computes unmet prereqs, header shows locked state + disabled "Locked" button.
3. **Module URL** (`app/courses/[id]/module/[moduleId]/page.tsx`): now a **server component** that gates before `ModuleContent` mounts — real enforcement, blocks even a stale/retroactive enrollment row.

### Phase 3 UI — instructor + admin content workflow (built, verified end-to-end)
Staged build; each stage verified with disposable fixtures (real user JWTs, exact-id cleanup) before proceeding. Migrations 010/011 applied live. **Commit status:** access/layout + Create Course + instructor upload committed; the admin review queue batch (`app/admin/review/`, `review-queue.tsx`, `review-detail.tsx`, `admin-sidebar.tsx` badge, `module-editor.tsx` "Edit & Resubmit") may still be uncommitted — check `git status`.
- **Access + layout:** `/instructor/*` gated in `middleware.ts` on `is_instructor AND status='active'` (mirrors the RLS pair). `InstructorHeader`/`InstructorSidebar`/`InstructorGuard` mirror the admin trio. Discovery links added to the shared `components/ui/header.tsx` dropdown: "Admin Panel" (if `is_admin`), "Instructor Panel" (if `is_instructor`) — both can show at once.
- **Admin Create Course** (`components/admin/create-course-form.tsx`, now the shared `CourseFormDialog` used for both create and edit): real insert/update via `courses_admin_write`. Instructor dropdown (`is_instructor AND active`), prerequisites tag input with live `suggest_course_titles()` "did you mean" + exact-match checkmark, non-blocking. (Superseded note: `course-management.tsx` was mock when this was written — it is real now, see below.)
- **Instructor module upload** (`components/instructor/instructor-course-list.tsx`, `module-editor.tsx`, route `app/instructor/courses/[courseId]/modules/[moduleId]/`): instructor sees only own courses (`instructor_id=auth.uid()`; RLS `courses_public_read` exposes all active, so the query does the scoping). New module → `draft`. One `resources` (type='pdf') + `lessons` (type='text', ascending `start_page`) via the embedded PDF viewer — "Add at page N" reads the page the viewer is on (`onPageChange`/`onDocumentLoad` callbacks added to `pdf-viewer.tsx`). Save draft / Submit for review (→ pending_review, submitted_by, submitted_at).
- **Admin review queue** (`components/admin/review-queue.tsx`, `review-detail.tsx`, routes `app/admin/review/` + `[moduleId]/`): pending_review list oldest-first w/ course + instructor name; detail embeds the PDF viewer + section breakdown; approve → published, reject → rejected (notes REQUIRED, no auto-reset). Live "N pending" badge in `admin-sidebar.tsx` (head+count). Instructor "Edit & Resubmit" on rejected modules → draft.

### Performance work (in progress — diagnostic done, first fixes landed)
- **Self-hosted fonts** (`app/layout.tsx` → `next/font/local`, files in `app/fonts/`): removed the build-time fetch to `fonts.gstatic.com` that failed offline and blocked `npm run build` entirely. Variable names (`--font-geist`/`--font-manrope`) unchanged. Build now succeeds with no Google Fonts network dependency. Bundle baseline recorded: shared First-Load floor ~101 kB, per-route 184–202 kB, react-pdf pages kept light via `dynamic({ssr:false})`.
- **Shared user context** (`components/providers/user-provider.tsx`, wraps `{children}` in root layout): replaces the ~3–4 independent `getUser()`+`users`-select calls per page (each of `AdminGuard`, `InstructorGuard`, `InstructorHeader`, `ui/header`, `InstructorCourseList` used to fetch on its own). Now one `getUser()`+profile select on mount, shared via `useUser()`. Invalidation: `onAuthStateChange` (SIGNED_OUT clears, SIGNED_IN/USER_UPDATED/TOKEN_REFRESHED refetch) + a profile-only refetch on navigation (catches DB-side role/status flips, which fire no auth event). **Middleware is untouched and remains the sole authoritative gate — the context is UX/display state only, never an access-control input.** Re-test consistency (each run ×3): dropdown (both-flags) 3/3, live-demotion (DB demote → nav-refetch drops Admin Panel + guard redirects /admin→/dashboard) 3/3; wrong-role login could not complete E2E here (browser sign-in fetch times out on this box — env, not logic; `login-form.tsx` unchanged by the refactor). Server-side middleware battery (curl) 9/9.
- **Timeout + retry on the shared context** (`user-provider.tsx`, both guards, `ui/header.tsx`): the initial load and `retry()` race `getUser()` and the profile select against a **9s timeout** (`withTimeout`), so a hung request never leaves the UI stuck at "Loading…". Context is now three-way — `loading` / `error` / ready — plus `retry()`. On `error` the provider shows a fixed **"Connection issue — couldn't reach the server. [Retry]"** banner (children still render beneath); `AdminGuard`/`InstructorGuard` show an inline Retry and **do NOT redirect** (a network hang is not a deauth); `ui/header` shows Retry instead of an infinite spinner. Background refetches (navigation, non-signout auth events) stay best-effort — keep the last-known-good profile on failure, never flip to `error`. Verified 12/12 (hang→banner+Retry+no-wrong-redirect, retry recovers, 9s timeout fires ~9.6s, dropdown/demotion still pass) via Playwright request interception.
- **Not addressed by the perf pass:** `images.unoptimized: true` in `next.config.mjs` (all `next/image` unoptimized). Catalog/detail fetch waterfalls, missing `revalidate`/cache on public pages, and the absent search debounce were all subsequently fixed; the `select('*')` over-fetching in `lib/database/queries.ts` is moot — that module is now down to the few helpers still in use.
- **DONE (was "polish batch"):** `AdminHeader` shows real identity via `useUser()` and the dead bell is gone.

---

## Environment / testing gotchas (learned this session)
- **Middleware `getUser()` fetch flakes on IPv6** (the same undici issue as scripts). Symptom: `Error: fetch failed` in the middleware stack → protected routes redirect to `/login` intermittently → Playwright/browsers land on login at random. **Fix: start the dev server with `NODE_OPTIONS=--dns-result-order=ipv4first npm run dev`.** For curl/node scripts, use `curl -4` (retry on exit 28).
- **Storage objects cannot be deleted via SQL** — `storage.protect_delete()` raises `42501`. Delete through the Storage API: `curl -X DELETE "$URL/storage/v1/object/course-materials" -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" -d '{"prefixes":["<exact/object/path>", ...]}'`. Returns the deleted names as its receipt. `storage.buckets` (size/mime limits) *is* updatable via SQL.
- **Playwright is available in the scratchpad** (`npm i playwright` + `npx playwright install chromium`), not the project. Browser tests build a real `sb-<ref>-auth-token` cookie (base64- prefix, chunked at 3180) from a password sign-in to drive the actual middleware/RLS.
- **Chromium also hits the IPv6 flake** — the browser's own `supabaseBrowser.auth.getUser()` / `signInWithPassword()` fetches hang or `ERR_CONNECTION_TIMED_OUT`, leaving headers stuck on "Loading..." or logins failing with "Failed to fetch". `NODE_OPTIONS` does NOT govern Chromium's DNS. Launch it with `--host-resolver-rules="MAP <supabase-host> <ipv4>"` to force IPv4. NOTE the Supabase host is Cloudflare-fronted and resolves to several edge IPs; some (seen: `172.64.149.246`) time out from this box while others (`104.18.38.10`) work — pin a known-good one. Even so, browser→Supabase auth calls are unreliable here; server-side (curl/node, ipv4first) is the dependable path for verifying auth.
- **⚠ Zombie dev server + `npm run build` clobbering `.next` (nasty, cost real time once).** If a `next dev` from an earlier run is still holding port 3000, a new `npm run dev` silently moves to **3001** (easy to miss the "Port 3000 is in use, trying 3001 instead" line). Then running `npm run build` overwrites `.next` with **production** artifacts while the zombie on 3000 is still serving its **dev** manifest → it serves HTML referencing CSS/JS chunks the build just replaced → `/_next/static/css/app/layout.css` 404 → the whole site renders as raw unstyled HTML. Symptom looks like a catastrophic CSS/layout break but nothing is actually wrong with the code. **Fix:** kill ALL node/next processes on 3000 AND 3001, `rm -rf .next`, start ONE clean `npm run dev`. Prevention: never `npm run build` while a dev server is running; confirm the dev server is actually on 3000.
- **Real accounts created this session** (not fixtures): `renmaddara02@gmail.com` (Darren Maddara, `is_instructor`, active) and `admin.test@example.com` (Admin Test, `is_admin`). This is why the live user count is 13, not the earlier 11.

---

## What's next (do NOT start without a planning prompt)

1. **DONE — admin management pages are real** (closes original QA finding #3): `course-management.tsx` (list/stats/edit/delete), `user-management.tsx` and `analytics-dashboard.tsx` all query live data; no hardcoded arrays remain. The unused `/api/users`, `/api/analytics`, `/api/enrollments` and `/api/certificates` (base) routes were deleted rather than wired up — the pages query Supabase directly. Every admin sidebar entry now points at a route that exists: `/admin`, `/admin/users`, `/admin/courses`, `/admin/review`, `/admin/assign`, `/admin/events`, `/admin/learning-paths`, `/admin/analytics`, `/admin/logs`.
2. **Wire `suggest_course_titles()` more widely:** only the Create Course prerequisites field uses it so far. Course title / other prerequisite inputs could get the same non-blocking nudge.
3. **Storage review-freeze consequence:** an instructor cannot replace a module's PDF while it's `pending_review` (011 mirrors the 009 lock). If admins ever need to hand a PDF back for reswap without a full reject, that's a new flow.

## Deliberate NON-goals (do not resurface as open items)
- **Email confirmation will NOT be enabled** — permanent product decision, not a technical gap. Registration stays confirmation-off (inline profile insert on the immediate session). Do not propose the SMTP + post-confirmation-profile-creation work; it is out of scope by choice.

---

## Test infrastructure

Reusable Playwright/curl scripts live in the session scratchpad (`.../scratchpad/`), not the repo: `lib-login.js` (shared login helper), `rls-adm.js` (service-role fixtures + exact-id cleanup helpers), and per-feature `test-*.js`. Pattern: create disposable fixtures → assert → clean up by exact id (courses/enrollments require check-first confirmation per rule 1). These are throwaway; re-create as needed.
