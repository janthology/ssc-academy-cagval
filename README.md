# Cagayan Valley Smart City Academy

E-learning platform for DOST Region 02's Smart and Sustainable Communities Program (SSCP).

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API Routes + Server Components
- **Database / Auth / Storage:** Supabase (PostgreSQL, Auth, Storage)

## Prerequisites

- Node.js 18+
- npm
- A Supabase project with the schema from `supabase/migrations/`

## Local setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your Supabase URL, anon key, service role key, and app URL.

3. **Apply database schema**

   If setting up a new Supabase project, run the SQL files in order:

   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`

   Optionally run `supabase/seed.sql` for development sample data.

   > **Existing deployments:** If your Supabase project already has tables, review migrations before applying. Use `supabase db diff` or apply RLS policies manually if the schema already exists.

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Project structure

```
app/              Pages and API routes (App Router)
components/       React UI components
lib/              Supabase clients, auth helpers, database queries
supabase/         SQL migrations, seed data, schema docs
middleware.ts     Auth session refresh and route protection
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-only) |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL for certificate verification QR codes |

## User roles

- **Guest** — Browse public pages (home, course catalog, learning paths listing)
- **Learner** — Enroll, track progress, earn certificates
- **Admin** — `users.is_admin = true`; access `/admin` routes

## Registration & email confirmation

Registration behavior depends on the Supabase Auth **Confirm email** toggle
(Authentication > Settings > Email Auth):

- **Confirm email OFF** (current configuration): `signUp()` returns a live
  session immediately. The app inserts the user's `public.users` profile row in
  the same step and redirects to `/login`. Registration is usable right away.
- **Confirm email ON**: `signUp()` returns a user but **no session** until the
  user clicks the confirmation link in their email. The registration form
  detects this and shows a "check your email to confirm your account" message
  instead of an error.

> **Important if you enable Confirm email:** the profile row in `public.users` is
> currently created inline during registration, which requires the immediate
> session that only exists when confirmation is OFF. With confirmation ON, that
> insert is intentionally skipped, so a confirmed user would have an `auth.users`
> record but **no `public.users` profile** — and the app's login/dashboard flow
> depends on that profile existing. Turning confirmation ON therefore also
> requires moving profile creation to a post-confirmation step (a database
> trigger on `auth.users`, or an auth-callback route) before the flow works
> end to end. See the `handle_new_user()` stub in `001_initial_schema.sql`.

## Content Workflow

Courses are produced through a review-gated pipeline:

1. **Admin creates the course shell** — title, category, description, and other
   course-level metadata — and **assigns an instructor** to it.
2. **Instructor uploads content** — modules and their materials (PDFs to the
   private `course-materials` bucket, lesson structure, etc.) for the assigned
   course.
3. **Admin reviews and approves** the submitted modules before the course is
   published. Nothing an instructor uploads goes live to learners until an admin
   approves it.

### Prerequisites

- A course's prerequisites are matched **live** against other courses by
  **case-insensitive exact course-title** comparison — there are no stored
  course-to-course links; the relationship is resolved at check time from the
  current catalog.
- Prerequisites are **hard-blocked**: a learner cannot enroll in a course until
  its prerequisite course(s) are satisfied.
- **Already-issued certificates are never revoked retroactively.** If a course
  later gains a new prerequisite, learners who already completed and were issued
  a certificate keep it — the new prerequisite only affects future enrollments.

## Protected routes

Middleware requires authentication for:

- `/dashboard/*`
- `/courses/*` (course detail and modules; catalog at `/courses` is public)
- `/learning-paths/*` (detail pages; listing is public)
- `/certificates/*`
- `/admin/*`

## API routes

| Route | Auth | Description |
|-------|------|-------------|
| `GET /api/courses` | Public | Active course catalog with filters |
| `POST /api/certificates/issue` | Authenticated | Issue certificate after course completion |
| `GET /api/certificates/verify/[id]` | Public | Verify a certificate (returns name/course/date only) |
| `GET /certificates/[id]/download` | Owner or admin | Download certificate as PDF |
| `POST /api/admin/log` | Admin | Record an admin action to the audit log |
| `GET /api/admin/logs` | Admin | Recent admin activity |
| `POST /api/revalidate` | Internal | On-demand ISR revalidation for public pages |

## Storage buckets

Create these buckets in Supabase Storage:

- `course-materials` — Module PDF files (private; signed URLs)
- `avatars` — User profile images

## Creating an admin user

After a user registers, promote them in Supabase SQL Editor:

```sql
UPDATE public.users
SET is_admin = true
WHERE email = 'admin@example.com';
```

## Deployment

Production URL: `https://sscacademy.dost02onedata.com`

### Deploying to Vercel

#### 1. Push to GitHub

The project root that Vercel should build is `smart-city-elearning/` (the folder containing `package.json`). If you are pushing from the repo root, set the **Root Directory** in Vercel to `smart-city-elearning`.

```
MIS-main/
└── smart-city-elearning/   ← set this as Root Directory in Vercel
    ├── app/
    ├── package.json
    ├── next.config.mjs
    └── vercel.json
```

#### 2. Create a Vercel project

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
2. Set **Root Directory** to `smart-city-elearning` (if your repo contains the outer folder).
3. Framework preset will auto-detect as **Next.js** — leave it.
4. Leave Build Command and Output Directory as their defaults (overridden by `vercel.json`).

#### 3. Add environment variables

In **Project Settings → Environment Variables**, add all four required variables:

| Variable | Environment | Notes |
|----------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview, Development | **Secret** — server-only, never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | Production | Your production domain, e.g. `https://sscacademy.dost02onedata.com` |
| `NEXT_PUBLIC_APP_URL` | Preview | Your Vercel preview URL or leave as `https://<your-project>.vercel.app` |

> **Security:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Never expose it in the browser. Vercel treats variables without `NEXT_PUBLIC_` as server-only automatically.

#### 4. Supabase CORS / Auth config

In your **Supabase dashboard → Authentication → URL Configuration**, add:

- **Site URL:** `https://sscacademy.dost02onedata.com`
- **Redirect URLs:** `https://sscacademy.dost02onedata.com/**`

Also add your Vercel preview domain pattern if you use preview deployments:
- `https://<your-project>-*.vercel.app/**`

#### 5. Deploy

Click **Deploy**. Vercel runs `npm install` then `npm run build`. The build should complete in ~2–3 minutes.

After the first deploy, subsequent pushes to `main` redeploy automatically.

#### 6. Verify the deployment

After deploying, check these routes manually:

- `/` — landing page loads
- `/courses` — course catalog renders (public, cached ISR)
- `/login` — login form works, Supabase auth connects
- `/dashboard` — redirects to `/login` when not authenticated
- `/admin` — redirects to `/dashboard` for non-admins
- `/certificates/[id]/download` — generates PDF (requires a real certificate id and login)

#### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Build fails with "Missing Supabase env vars" | Env vars not set in Vercel | Add all four vars in Project Settings |
| Auth redirects loop on login | `NEXT_PUBLIC_APP_URL` missing or wrong | Set it to your exact production URL with `https://` |
| Certificate PDF is blank / QR code broken | `NEXT_PUBLIC_APP_URL` not set | Ensure it is set to the full `https://` URL |
| `supabaseAdmin()` throws at runtime | `SUPABASE_SERVICE_ROLE_KEY` not set | Add it as a non-public env var in Vercel |
| Images/avatars broken | Supabase storage hostname not whitelisted | Already handled in `next.config.mjs` — no action needed |
| Middleware redirects every request to `/login` | Supabase URL unreachable or env var typo | Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values |

#### Self-hosted (non-Vercel)

```bash
npm run build
npm run start    # listens on 0.0.0.0 by default (see package.json)
```

Set all four environment variables in your host's environment. Ensure `SUPABASE_SERVICE_ROLE_KEY` is **never** prefixed with `NEXT_PUBLIC_`.

## Documentation

- Schema reference: `supabase/README.md`
- Completion roadmap: see project planning docs in repository discussions

## License

Private — DOST Region 02 (Cagayan Valley).
