# Supabase Schema Reference

Database schema for the Cagayan Valley Smart City Academy platform.

## Applying migrations

### New project

1. Open Supabase Dashboard → SQL Editor
2. Run `migrations/001_initial_schema.sql`
3. Run `migrations/002_rls_policies.sql`
4. Optionally run `seed.sql` for sample data

### Existing project

If tables already exist in production:

- **Do not** blindly re-run `001_initial_schema.sql`
- Run `migrations/002_rls_policies.sql` — it patches missing columns (e.g. `users.status`, `users.is_admin`) before applying policies
- Compare your live schema with this reference and reconcile any other differences

## Tables

| Table | Description |
|-------|-------------|
| `users` | User profiles linked to `auth.users` |
| `courses` | Course catalog |
| `modules` | Course modules (ordered) |
| `lessons` | Lessons within modules (page markers for PDFs) |
| `resources` | Module files (PDF paths in storage) |
| `learningoutcomes` | Course learning outcomes |
| `learningpaths` | Curated multi-course tracks |
| `learningpath_courses` | Junction: paths ↔ courses |
| `enrollments` | User course enrollments |
| `progress` | Per-lesson completion tracking |
| `certificates` | Issued course certificates |
| `organizations` | Verified organization registry |
| `admin_logs` | Admin action audit trail |

## RPC functions

| Function | Description |
|----------|-------------|
| `enroll_and_track_progress(enrollment_input, progress_inputs)` | Atomically creates enrollment and seeds progress rows. Callable by authenticated users for their own `user_id`. |

## Storage buckets

| Bucket | Access | Purpose |
|--------|--------|---------|
| `course-materials` | Private (signed URLs) | Module PDF files |
| `avatars` | Public read | User profile photos |

## Helper functions

| Function | Description |
|----------|-------------|
| `is_admin()` | Returns `true` if current user has `is_admin = true` |
| `is_active_user()` | Returns `true` if current user has `status = 'active'` |

## Security model

- **Learners** can read/write their own enrollments and progress
- **Admins** (`users.is_admin = true`) have full read/write on management tables
- **Certificates** cannot be inserted from the client; issuance goes through `POST /api/certificates/issue` using the service role key after server-side completion validation
- **Admin logs** are read-only from the client; writes happen server-side
- **Public** can read active courses, modules, lessons, and learning paths

## User types

`individual`, `lgu`, `suc`, `hei`, `dost`, `government`

## Certificate format

- Number: `DOST02SSCP-{uuid}`
- Verification: SHA-256 hash stored in `verification_hash`
- Public verification at `/verify/[id]`
