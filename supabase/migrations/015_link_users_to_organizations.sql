-- ===========================================================================
-- 015_link_users_to_organizations.sql
--
-- Gives users a REAL link to the organizations registry, replacing the
-- free-text-only grouping that made "Team Progress" impossible to build.
--
-- Design notes:
--  * users.organization (free text) is KEPT. It stays the fallback/historical
--    value for anyone who is not linked. This migration never clears it.
--  * Backfill is EXACT (case-insensitive, trimmed) match ONLY. Fuzzy matches
--    are suggestions, never automatic — the same rule already used for course
--    prerequisite titles (008: get_unmet_prerequisites = exact,
--    suggest_course_titles = suggestion only).
--    On the data at authoring time this links 0 rows: the registry holds
--    formal names ("DOST Region 2") while users typed variants ("DOST",
--    "DOST RO2"). That is expected and correct — linkage happens going
--    forward via the organization picker in registration / profile settings.
--  * New organization creation stays admin-only via the existing
--    organizations_admin_write policy (002). No self-service org creation.
--
-- APPLY IN 4 CHUNKS, IN ORDER. Each chunk is delimited below.
-- ===========================================================================


-- ===========================================================================
-- CHUNK 1 of 4 — extension, FK column, index, and organizations read access
-- ===========================================================================

-- pg_trgm already installed by 008 (repeated so this file stands alone).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- The FK. ON DELETE SET NULL: deleting an organization unlinks its members,
-- it never deletes users (same convention as learningpaths.created_by).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_organization_id
  ON public.users(organization_id);

-- Organization read access — widened from authenticated-only to include anon.
--
-- WHY: the organization picker runs during REGISTRATION, where the session is
-- necessarily anonymous (pre-signup). Verified against the live database
-- before writing this migration: an anon request to /rest/v1/organizations
-- returned [] (HTTP 200) while the same request as service role returned all
-- rows — i.e. the old organizations_authenticated_read policy silently gave
-- the registration picker an empty registry, so no exact match could ever be
-- found and every new user fell through to unlinked free text.
--
-- Organization names/types are not sensitive; this is the same public tier as
-- the course catalog (courses_public_read). Writes are untouched: creating or
-- editing an organization still requires organizations_admin_write, and
-- is_verified remains admin-controlled. Renamed to *_public_read to match the
-- existing convention (courses_public_read, modules_public_read, ...).
--
-- Not filtered on is_verified: registry curation is an admin-side concern, and
-- filtering here would hide rows the admin deliberately added.
DROP POLICY IF EXISTS "organizations_authenticated_read" ON public.organizations;
DROP POLICY IF EXISTS "organizations_public_read" ON public.organizations;
CREATE POLICY "organizations_public_read" ON public.organizations
  FOR SELECT USING (TRUE);


-- ===========================================================================
-- CHUNK 2 of 4 — backfill (exact match only, never fuzzy)
--
-- Run the pre-check SELECT first and eyeball it. It lists exactly which users
-- WOULD be linked. Anything not in that list stays unlinked by design — a
-- fuzzy near-miss ("DOST" vs "DOST Region 2") must never be auto-linked.
-- ===========================================================================

-- PRE-CHECK (read-only). Expect: the rows this UPDATE will touch, and nothing
-- else. At authoring time this returns 0 rows.
SELECT u.id            AS user_id,
       u.name          AS user_name,
       u.organization  AS free_text,
       o.id            AS will_link_to_id,
       o.name          AS will_link_to_name
FROM public.users u
JOIN public.organizations o
  ON lower(trim(u.organization)) = lower(trim(o.name))
WHERE u.organization_id IS NULL
  AND u.organization IS NOT NULL
ORDER BY u.name;

-- THE BACKFILL.
UPDATE public.users u
SET organization_id = o.id
FROM public.organizations o
WHERE u.organization_id IS NULL
  AND u.organization IS NOT NULL
  AND lower(trim(u.organization)) = lower(trim(o.name));


-- ===========================================================================
-- CHUNK 3 of 4 — get_my_team_progress()
--
-- SECURITY DEFINER, scoped to the caller's own organization.
--
-- users_select_own (002/003) means a learner cannot SELECT other users at all.
-- Rather than widen that policy, teammates are reachable ONLY through this
-- function, which uses auth.uid() internally (no caller-supplied id, same
-- pattern as get_unmet_prerequisites) and returns display columns only — name,
-- position, counts. No email, no status, no role flags.
--
-- Caller with organization_id IS NULL gets zero rows (no leak, clean empty
-- state). Metrics are raw counts from real enrollment data; the caller derives
-- rates from them. Nothing is invented:
--   enrollments_count = enrolments the member has
--   completed_count   = those with status='completed'
--   progress_sum      = SUM(enrollments.progress), the real 0-100 column
--
-- Inactive accounts are excluded so deactivated users do not pad rosters or
-- skew averages.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_my_team_progress()
RETURNS TABLE (
  member_id         uuid,
  member_name       text,
  member_position   text,
  enrollments_count integer,
  completed_count   integer,
  progress_sum      integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.name,
    u.position,
    COUNT(e.id)::int,
    COUNT(e.id) FILTER (WHERE e.status = 'completed')::int,
    COALESCE(SUM(e.progress), 0)::int
  FROM public.users u
  LEFT JOIN public.enrollments e ON e.user_id = u.id
  WHERE u.status = 'active'
    AND u.organization_id IS NOT NULL
    AND u.organization_id = (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  GROUP BY u.id, u.name, u.position
  ORDER BY u.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_team_progress() TO authenticated;


-- ===========================================================================
-- CHUNK 4 of 4 — suggest_organizations()
--
-- Fuzzy suggestion (SUGGESTION ONLY — never used to link automatically).
-- Direct mirror of suggest_course_titles (008). "Did you mean ...?" when a
-- user types an organization name that nearly matches a registry entry.
--
-- Granted to anon as well as authenticated: the picker runs pre-signup on the
-- registration form. Note that Postgres already grants EXECUTE to PUBLIC by
-- default (verified live: an anon session can call suggest_course_titles and
-- gets the same rows as service role), so this GRANT is explicit intent
-- rather than a fix — it keeps anon working if EXECUTE is ever revoked from
-- PUBLIC in a hardening pass.
-- ===========================================================================
-- NOTE: `type` is declared `text`, not public.organization_type. Verified against
-- the live database: organizations.type is a TEXT column there, despite 001
-- declaring an enum (the live DB was not built from 001 — see HANDOFF "Live
-- schema reality"). Declaring the enum here fails with a result-type mismatch.
CREATE OR REPLACE FUNCTION public.suggest_organizations(p_input text, p_threshold real DEFAULT 0.3)
RETURNS TABLE (id uuid, name text, type text, score real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.type, similarity(o.name, p_input) AS score
  FROM public.organizations o
  WHERE lower(trim(o.name)) <> lower(trim(p_input))   -- exclude exact matches
    AND similarity(o.name, p_input) >= p_threshold
  ORDER BY score DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_organizations(text, real) TO authenticated, anon;
