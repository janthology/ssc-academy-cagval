# Cagayan Valley Smart City Academy — Project Summary

**E-learning platform for DOST Region 02's Smart and Sustainable Communities Program (SSCP).**

Work period: **21 July – 30 July 2026** · **48 commits of implementation work, plus documentation** · **111 files changed** (+8,930 / −2,085 lines) · **18 database migrations**

---

## 1. What the platform is

A web-based training platform for the DOST Region 02 Smart and Sustainable Communities Program. It delivers structured courses to participants across Region 02 — Local Government Units (LGUs), State Universities and Colleges (SUCs), Higher Education Institutions (HEIs), DOST personnel, other government agencies, and individual learners.

**Three roles:**

| Role | What they do |
|---|---|
| **Learner** | Browse the catalogue, enrol, read course modules (PDF-based with page-marked lessons), track progress, earn verifiable certificates |
| **Instructor** | Author course modules, upload materials, submit work for admin review |
| **Admin** | Review and approve/reject instructor submissions, manage courses, users, learning paths, events, and view platform analytics |

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (PostgreSQL, Auth, Storage).
**Current size:** 30 page routes, 6 API routes, 100 components, 16 database tables.

---

## 2. State at handoff — what existed before this work

The project arrived as a **working prototype**: the visual design, page layouts, and component library were largely in place, and basic authentication worked. Underneath that surface, three categories of problem existed.

**Security was not enforced.** The database had Row Level Security policies, but they had been created ad-hoc through the Supabase dashboard rather than through version-controlled migrations. Several were dangerously permissive. Critically, **the live database did not match the migration files in the repository** — policies and columns existed in production that appeared in no migration, and constraints declared in migrations had never actually been applied.

**Much of the interface displayed fabricated data.** Multiple admin and dashboard screens rendered hardcoded arrays that looked like real records — user lists, analytics figures, course management tables, upcoming events, team statistics. Some carried a "[Placeholder: no data available yet]" caption directly above invented specifics, which is arguably worse than showing nothing.

**The core requested feature did not exist.** There was no instructor role, no content authoring capability, and no admin review workflow — the central ask of the engagement.

---

## 3. Critical issues found and fixed — the security remediation arc

This was the largest and most consequential part of the work. A structured QA audit of the database identified numbered findings, each closed by a version-controlled migration or an application-layer fix, and verified against the live database with disposable test accounts before being considered done.

### Vulnerabilities closed

| # | Vulnerability | Impact | Fixed in |
|---|---|---|---|
| 1 | **Login authentication bypass** | A failed post-login role check left the sign-in session alive, so a rejected user could simply navigate to `/dashboard` and be treated as logged in | commit `b40dfde` |
| 2 | **Session validity never re-checked** | Middleware authorized requests using `getSession()`, which only decodes the browser cookie. Revoked or stale sessions were accepted. Replaced with `getUser()`, which revalidates against the auth server | commit `e52bdf6` |
| 3 | **User PII publicly readable** | A policy allowed full-table public read of `users` — every participant's name, email, organization, position, city, **and admin status**, readable by anyone, authenticated or not | 003 |
| 4a | **All certificates publicly readable** | An unconditional policy exposed every certificate row to anyone, regardless of status or ownership | 003 |
| 4b | **Any active certificate readable by any caller** | A carve-out in `certificates_select_own` (`OR status = 'active'`, added to allow public verification) let any caller read any active certificate regardless of ownership. Closed by restricting the policy to owner-or-admin and moving public verification to a dedicated server route that returns only safe fields | 004 |
| 5 | **Admin self-escalation** | Any authenticated user could insert or update their own `is_admin` flag and grant themselves full administrative control, via both the insert and update paths | 003 |
| 6 | **Unrestricted course modification** | Loose UPDATE grants let any authenticated user modify any course | 003 |
| 7 | **Certificate download IDOR** | The certificate download route performed no ownership check — any authenticated user could download any other participant's certificate PDF by guessing or obtaining its ID. Fixed at the application layer by requiring authentication and explicitly verifying owner-or-admin | commit `c2fee1d` |
| 8 | **Certificate tampering** | A `FOR ALL` policy meant certificate owners could UPDATE or DELETE their own certificate records — a learner could alter or destroy the record of their own credential | 003 |
| 9 | **Lesson content tampering** | Policies allowed *any* authenticated user to insert, update or delete *any* lesson platform-wide, on any course | 008 |
| 10 | **Course materials exposed at the storage layer** | Database rows were guarded, but the storage bucket was not: *any* authenticated account could read every course PDF, and upload arbitrary files to any path. The read policy's name claimed to check enrolment; it never did | 011 |
| 11 | **Prerequisite bypass** | Prerequisites were enforced in the UI but not in the database function that performs enrolment — a direct API call bypassed them entirely | 012 |
| 12 | **Instructor edits during review** | Instructors could alter a module after submitting it, so an admin could approve content different from what they reviewed | 009 |
| 13 | **Archived learning paths readable** | Archived (withdrawn) learning paths and their contents remained readable by all users and by anonymous visitors | 018 |
| 14 | **Permanent creator rights** | Policies granted UPDATE/DELETE based only on who *created* a record, never re-checking current admin status — so a **demoted administrator kept edit and delete rights on their old content forever** | 018 |

**Fourteen distinct vulnerability classes closed.** Two (1–2) were application-layer authentication flaws fixed in the first days of work. Five came from the original QA audit's numbered findings. The remaining seven were found by continued auditing while building features — including two discovered only because a new feature's tests exercised behaviour the migration files did not predict.

### The recurring pattern: live database vs. migration files

The single most important lesson of this project. **On seven separate occasions**, the live database was found to disagree with the repository's migration files:

- **Migration 003** — eight undocumented policies on the `users` table alone, several of them the vulnerabilities listed above
- **Migration 005** — an enrollment-count trigger existed in production that no migration had created
- **Migration 006** — a column was named `learningpath_id` live, but `learning_path_id` in the schema file
- **Migration 007** — a uniqueness constraint declared in the initial schema had never actually been applied, allowing duplicate enrolments
- **Migration 008** — nine undocumented policies across `modules`, `lessons` and `resources`, including the three that let any authenticated user insert, update or delete any lesson
- **Migration 011** — three undocumented storage policies on the course-materials bucket. A fourth policy there *was* documented but misleadingly named: `course_materials_enrolled_read` never checked enrolment despite its name
- **Migration 018** — eight further undocumented policies (four each on two tables), found only because a newly built feature behaved differently from what the migration files predicted

**Twenty-eight undocumented policies were removed in total** (8 in 003, 9 in 008, 3 in 011, 8 in 018).

Additionally, several column types differ live from what the initial schema declares (for example `organizations.type` is plain text, not the declared enum) — differences that cause immediate failures if trusted blindly.

**Practical consequence:** every database change in this project was verified against the live system, not assumed from the files. That discipline is why findings 13 and 14 were caught at all.

### Also removed

A component presenting **fabricated blockchain verification claims** for certificates was deleted outright. It was unreferenced, non-functional, and asserted a security property the platform does not have — a misleading claim on a credential is a credibility risk, not a cosmetic one.

---

## 4. New features built

### The instructor and admin content review workflow — the core original ask

A complete authoring-and-approval pipeline, built from nothing:

- **Instructor role and workspace** — dedicated area, gated at the middleware level on instructor status *and* active account
- **Module authoring** — instructors upload a PDF and define lessons as page markers within it, using an embedded viewer that captures the current page ("Add at page N")
- **Course ownership** — instructors see and edit only their own courses
- **Submission workflow** — Draft → Submitted for review → Approved (published) or Rejected. Rejections **require** a written reason
- **Edit lock during review** — content freezes on submission, so admins always approve exactly what they reviewed
- **Admin review queue** — pending submissions oldest-first, with the PDF and section breakdown embedded in the review screen
- **Edit & resubmit** — rejected work returns to draft for revision
- **Standalone modules** — instructors can author a module before it is assigned to any course; admins assign it later, with override logging when an assignment crosses ownership boundaries

### Built beyond the original scope

- **In-app notifications** — instructors are notified when a module is approved, rejected (with the reviewer's note included), or assigned to a course; learners are notified when a certificate is issued. Created by database triggers rather than application code, so a notification cannot be forged from the client
- **Team Progress** — participants can now be linked to a real organization from the registry rather than free-typed text. Their organization's page shows genuine completion rate and average progress computed from actual enrolment records, isolated so one organization can never see another's members
- **Platform Events** — admin-managed announcements (live sessions, hands-on workshops, conferences) shown on every learner's dashboard and on a public events page, replacing the invented events that shipped before
- **Learning Paths administration** — full create/edit/delete for curated multi-course tracks with drag-free ordering, replacing a table that could previously only be edited directly in the database
- **Prerequisite enforcement** — enforced consistently at the catalogue, course detail, module access, and database function levels
- **Certificate integrity** — issuance blocked on courses with no lessons, with an honest error instead of a silent failure
- **Admin audit trail** — administrative actions are recorded to a real activity log
- **Self-service password reset** — a participant who forgets their password can recover it themselves, without an administrator. The request screen returns the same message whether or not the address is registered, so it cannot be used to discover who holds an account; reset links are single-use and expire

### Honesty pass over the interface

Every screen showing invented data was either connected to real data or removed:

- User Management, Course Management, and the Analytics dashboard now query live records
- The admin header shows the real signed-in administrator
- Fabricated dashboard statistics were removed rather than approximated
- Navigation links pointing at non-existent pages were removed or built
- A non-functional "Invite Team Members" button was removed rather than left to do nothing when clicked
- The Profile Settings preference switches, which silently discarded every change, are now genuinely disabled and labelled "Not yet available" — each with a note stating what actually happens today, so a switched-off toggle is not mistaken for a broken feature
- Two remaining demonstration learning paths are clearly labelled as such in the admin interface, with a switch to hide them — the honest interim while real content is authored

---

## 5. Performance and reliability work

- **Build fix** — the production build failed entirely without internet access because fonts were fetched at build time. Fonts are now self-hosted; the build has no external dependency
- **Shared authentication context** — replaced 3–4 duplicate identity lookups per page with a single shared one
- **Resilience** — authentication requests now have a 9-second timeout with a retry option. Previously a hung request left users on an infinite loading spinner; a network failure is now correctly distinguished from a genuine sign-out, so a blip no longer ejects a working session
- **Search debounce** — course search no longer issues a request per keystroke; superseded requests are cancelled
- **Query trimming** — replaced broad `SELECT *` queries with explicit column lists on hot paths
- **Image optimization** — enabled Next.js image optimization (previously disabled outright) and lazy-loaded catalogue images
- **Server rendering and caching** — the public catalogue and course pages are now server-rendered and cached, refreshing immediately when an admin publishes rather than waiting out a cache window
- **Dead code removal** — 10 unused database helpers and 4 unused API routes deleted after confirming zero references

---

## 6. Known limitations and deliberate non-goals

**Deliberate decisions, not oversights:**

- **Email confirmation is off.** Enabling it requires a configured SMTP provider and a decision about who operates it. The registration flow already handles the confirmation path correctly if it is switched on later — this is a deployment decision, not missing code
- **Terms of Service and Privacy Policy are not written.** The links exist but are inert. These require actual legal text from the SSCP program, particularly regarding participant data handling. A developer should not invent them

**Operational note, not a defect:**

- **Password reset uses Supabase's built-in mailer.** This works today and required no additional infrastructure — confirmed against the live system, including that it still sends correctly while signup confirmation is switched off. The built-in mailer is, however, rate-limited and not intended for production volume. If reset requests become frequent, configuring custom SMTP in the Supabase dashboard is the recommended step — a settings change, with no code change required

**Genuine gaps:**

- **Preference toggles are disabled, not built.** The notification and privacy switches in Profile Settings are now honestly non-interactive with a "Not yet available" note, rather than silently discarding changes. Storing real preferences remains unbuilt
- **Two demonstration learning paths remain.** Their ~18 listed courses do not exist on the platform — verified individually against the catalogue with zero matches. They are labelled as placeholders in the admin interface and can be switched off; they should be deleted once real paths replace them
- **The production cache behaviour is only partly verifiable locally.** Development servers do not cache the way production does

---

## 7. Remaining and future work

Roughly in priority order:

1. **Author real content.** The platform is ready; it currently holds a small number of courses and one genuine learning path. This is a content task, not a development one
2. **Supply Terms of Service and Privacy Policy text** from the program
3. **Decide on email confirmation** and configure SMTP if it is wanted — the same SMTP decision also lifts the rate limit on password-reset emails
4. **Store real notification and privacy preferences**, so the disabled toggles can be enabled
5. **Wire the "Change Password" button** in Profile Settings to the reset flow that now exists — small, and the last remaining disabled control with a working counterpart behind it
6. **Build the deferred learner screens** — personal Analytics, Organization, and Help Center are visible-but-greyed in the sidebar, honestly marked as unbuilt rather than broken

---

## Summary

The platform arrived looking finished and was not. Fourteen distinct security vulnerabilities were closed, including exposure of every participant's personal information, a path for any user to grant themselves administrator access, and an authentication bypass that let a rejected login proceed anyway. The requested instructor and admin review workflow was built end to end, along with several features beyond the original scope. Every screen that displayed invented data was connected to real records or removed, and every control that looked functional but was not is now either working or honestly disabled.

What remains open is largely not development work: authoring real course content, and supplying the legal text and email-provider decisions that belong to the program rather than to a developer.

Every database change was verified against the live system with disposable test accounts and cleaned up afterwards, because this project repeatedly demonstrated that the migration files alone could not be trusted to describe reality.
