-- 008_phase3_instructor_content_workflow.sql
-- Phase 3: instructor role, course ownership, module review workflow, status-aware
-- RLS, prerequisite checking, and fuzzy title suggestion. Bundled as one migration
-- because the pieces are interdependent (splitting leaves the app half-broken).
--
-- DATA SAFETY (existing modules): modules.status is added with DEFAULT 'published'
-- so the 23 existing live modules stay visible under the new published-only read
-- policy, THEN the default is switched to 'draft' for future inserts. No UPDATE
-- overwrites existing rows.

-- ===========================================================================
-- 0. Extensions
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ===========================================================================
-- 1. Role model — instructor flag + helper (identical shape to is_admin())
-- ===========================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_instructor BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_instructor FROM public.users WHERE id = auth.uid()),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_instructor() TO authenticated, anon;

-- ===========================================================================
-- 2. Course ownership
-- ===========================================================================
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ===========================================================================
-- 3. Module review state (text + CHECK per live convention, not a new enum).
--    Existing rows backfill to 'published' via the column default; future rows
--    default to 'draft'.
-- ===========================================================================
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'pending_review', 'published', 'rejected'));
ALTER TABLE public.modules ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.users(id);
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES public.users(id);
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- ===========================================================================
-- 4. RLS cleanup — drop dead JWT-based and unconditional duplicate policies
--    (keeps the scoped snake_case migration policies: modules_public_read,
--     lessons_public_read, resources_enrolled_read, and the *_admin_write trio).
-- ===========================================================================
DROP POLICY IF EXISTS "Allow authenticated insert on lessons" ON public.lessons;
DROP POLICY IF EXISTS "Allow authenticated update on lessons" ON public.lessons;
DROP POLICY IF EXISTS "Allow authenticated delete on lessons" ON public.lessons;
DROP POLICY IF EXISTS "Admins full access to lessons"         ON public.lessons;
DROP POLICY IF EXISTS "Allow public read access to lessons"   ON public.lessons;

DROP POLICY IF EXISTS "Admins full access to modules"         ON public.modules;
DROP POLICY IF EXISTS "Allow public read access to modules"   ON public.modules;

DROP POLICY IF EXISTS "Admins full access to resources"        ON public.resources;
DROP POLICY IF EXISTS "Allow enrolled users to read resources" ON public.resources;

-- ===========================================================================
-- 5. Status/ownership-aware READ policies (replace the scoped read policies).
--    admin = all; non-owner = published module of active course;
--    instructor-owner = all their own regardless of status.
-- ===========================================================================
DROP POLICY IF EXISTS "modules_public_read" ON public.modules;
CREATE POLICY "modules_public_read" ON public.modules
  FOR SELECT USING (
    public.is_admin()
    OR (
      modules.status = 'published'
      AND EXISTS (SELECT 1 FROM public.courses c
                  WHERE c.id = modules.course_id AND c.is_active = TRUE)
    )
    OR (
      public.is_instructor()
      AND EXISTS (SELECT 1 FROM public.courses c
                  WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "lessons_public_read" ON public.lessons;
CREATE POLICY "lessons_public_read" ON public.lessons
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id
        AND m.status = 'published' AND c.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id
        AND public.is_instructor() AND c.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "resources_enrolled_read" ON public.resources;
CREATE POLICY "resources_enrolled_read" ON public.resources
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      JOIN public.enrollments e ON e.course_id = m.course_id
      WHERE m.id = resources.module_id
        AND m.status = 'published' AND c.is_active = TRUE
        AND e.user_id = auth.uid()
        AND e.status IN ('active', 'completed')
    )
    OR EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = resources.module_id
        AND public.is_instructor() AND c.instructor_id = auth.uid()
    )
  );

-- ===========================================================================
-- 6. Instructor WRITE policies (INSERT/UPDATE only; no DELETE for instructors).
--    Require is_instructor() AND is_active_user() AND course ownership. A
--    suspended/deactivated instructor cannot write. Admin writes remain via the
--    existing *_admin_write policies.
-- ===========================================================================

-- modules: instructor may create/edit own-course modules but may NEVER set status
-- to 'published' or 'rejected' — only 'draft'/'pending_review'. Admin does
-- publish/reject via modules_admin_write (is_admin()).
DROP POLICY IF EXISTS "modules_instructor_insert" ON public.modules;
CREATE POLICY "modules_instructor_insert" ON public.modules
  FOR INSERT WITH CHECK (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (SELECT 1 FROM public.courses c
                WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
    AND modules.status IN ('draft', 'pending_review')
  );

DROP POLICY IF EXISTS "modules_instructor_update" ON public.modules;
CREATE POLICY "modules_instructor_update" ON public.modules
  FOR UPDATE USING (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (SELECT 1 FROM public.courses c
                WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
  )
  WITH CHECK (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (SELECT 1 FROM public.courses c
                WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
    AND modules.status IN ('draft', 'pending_review')   -- escalation guard
  );

-- lessons: instructor may create/edit lessons of their own course's modules.
DROP POLICY IF EXISTS "lessons_instructor_insert" ON public.lessons;
CREATE POLICY "lessons_instructor_insert" ON public.lessons
  FOR INSERT WITH CHECK (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND c.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lessons_instructor_update" ON public.lessons;
CREATE POLICY "lessons_instructor_update" ON public.lessons
  FOR UPDATE USING (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND c.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND c.instructor_id = auth.uid()
    )
  );

-- resources: same ownership scoping.
DROP POLICY IF EXISTS "resources_instructor_insert" ON public.resources;
CREATE POLICY "resources_instructor_insert" ON public.resources
  FOR INSERT WITH CHECK (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = resources.module_id AND c.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "resources_instructor_update" ON public.resources;
CREATE POLICY "resources_instructor_update" ON public.resources
  FOR UPDATE USING (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = resources.module_id AND c.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = resources.module_id AND c.instructor_id = auth.uid()
    )
  );

-- ===========================================================================
-- 7. Prerequisite check — single source of truth for all enforcement points.
--    Uses auth.uid() internally (no caller-supplied user id). Returns unmet
--    prerequisite titles (empty = eligible). Titles with no matching live course
--    are ignored entirely (never block).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_unmet_prerequisites(p_course_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(req.prereq_title), ARRAY[]::text[])
  FROM (
    SELECT unnest(prerequisites) AS prereq_title
    FROM public.courses
    WHERE id = p_course_id
  ) req
  WHERE
    -- a live course with a case-insensitive, trimmed exact title match exists
    EXISTS (
      SELECT 1 FROM public.courses pc
      WHERE lower(trim(pc.title)) = lower(trim(req.prereq_title))
        AND pc.is_active = TRUE
    )
    -- ...and the current user has NOT completed any such matching course
    AND NOT EXISTS (
      SELECT 1
      FROM public.courses pc
      JOIN public.enrollments e ON e.course_id = pc.id
      WHERE lower(trim(pc.title)) = lower(trim(req.prereq_title))
        AND pc.is_active = TRUE
        AND e.user_id = auth.uid()
        AND e.status = 'completed'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_unmet_prerequisites(uuid) TO authenticated;

-- ===========================================================================
-- 8. Fuzzy suggestion (SUGGESTION ONLY — never used for enforcement).
--    "Did you mean an existing title?" when typing a course/prerequisite title.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.suggest_course_titles(p_input text, p_threshold real DEFAULT 0.3)
RETURNS TABLE (id uuid, title text, score real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.title, similarity(c.title, p_input) AS score
  FROM public.courses c
  WHERE c.is_active = TRUE
    AND lower(trim(c.title)) <> lower(trim(p_input))   -- exclude exact matches
    AND similarity(c.title, p_input) >= p_threshold
  ORDER BY score DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_course_titles(text, real) TO authenticated;
