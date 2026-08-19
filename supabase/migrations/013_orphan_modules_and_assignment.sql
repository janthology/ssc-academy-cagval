-- 013_orphan_modules_and_assignment.sql
-- Allow instructors to create/upload/review a module BEFORE it is assigned to a
-- course, and make course assignment an admin-only action.
--
-- Model: modules.course_id is nullable (confirmed live). An "orphan" module has
-- course_id IS NULL and is owned by its creator (modules.created_by). Ownership
-- across lessons/resources/storage is unified in public.owns_module(): the course's
-- assigned instructor for an assigned module, or the creator for an orphan.
--
-- CORRECTION 1 (course_id immutability): RLS WITH CHECK cannot reference the OLD
--   row, so "instructor may not change course_id" cannot live in a policy. It is
--   enforced by a BEFORE UPDATE trigger that blocks any course_id change unless
--   is_admin(). Assignment therefore flows only through modules_admin_write.
-- CORRECTION 2 (orphan-safe joins): storage instructor branches go through
--   owns_module() (LEFT JOIN internally); the enrolled-read branch keeps its inner
--   joins on purpose (orphans are not enrolled-readable).

-- ===========================================================================
-- 1. Schema: track the creator on every module
-- ===========================================================================
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill existing modules: prefer the submitter, else the course's instructor.
UPDATE public.modules m
SET created_by = COALESCE(m.submitted_by, c.instructor_id)
FROM public.courses c
WHERE m.course_id = c.id AND m.created_by IS NULL;

-- ===========================================================================
-- 2. Ownership helper (single source of truth; LEFT JOIN handles orphans)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.owns_module(p_module_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.modules m
    LEFT JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = p_module_id
      AND (
        (m.course_id IS NOT NULL AND c.instructor_id = auth.uid())  -- assigned: course owner
        OR (m.course_id IS NULL  AND m.created_by   = auth.uid())    -- orphan: creator
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.owns_module(uuid) TO authenticated;

-- ===========================================================================
-- 3. CORRECTION 1 — course_id is admin-only-mutable (trigger; RLS can't see OLD)
--    Blocks any UPDATE that changes course_id unless the caller is an admin.
--    Assignment/reassignment therefore only ever happens via modules_admin_write.
--    (Service-role callers have no JWT, so is_admin() is false for them too — set
--     course_id at INSERT, or via an admin session, not a bare service-role UPDATE.)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.enforce_module_course_id_admin_only()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.course_id IS DISTINCT FROM OLD.course_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can assign or reassign a module to a course';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_module_course_id_admin_only ON public.modules;
CREATE TRIGGER trg_module_course_id_admin_only
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_module_course_id_admin_only();

-- ===========================================================================
-- 4. modules RLS (inlined — the row's own table)
-- ===========================================================================

-- READ: admin; published module of an active course; assigned-owner; OR the
-- creator of an orphan (an orphan is never publicly visible — it has no active
-- course, so the published-branch never matches it).
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
    OR (
      public.is_instructor()
      AND modules.course_id IS NULL
      AND modules.created_by = auth.uid()
    )
  );

-- INSERT: active instructor, creator pinned to self (anti-forge), non-publish
-- status, on a course they own OR as an orphan (course_id NULL).
DROP POLICY IF EXISTS "modules_instructor_insert" ON public.modules;
CREATE POLICY "modules_instructor_insert" ON public.modules
  FOR INSERT WITH CHECK (
    public.is_instructor()
    AND public.is_active_user()
    AND modules.created_by = auth.uid()
    AND modules.status IN ('draft', 'pending_review')
    AND (
      EXISTS (SELECT 1 FROM public.courses c
              WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
      OR modules.course_id IS NULL
    )
  );

-- UPDATE: own course-assigned module OR own orphan, only while draft/rejected
-- (009 freeze). Escalation guard on the resulting status unchanged. course_id
-- immutability is enforced by the trigger above, NOT here (RLS can't see OLD).
DROP POLICY IF EXISTS "modules_instructor_update" ON public.modules;
CREATE POLICY "modules_instructor_update" ON public.modules
  FOR UPDATE
  USING (
    public.is_instructor()
    AND public.is_active_user()
    AND modules.status IN ('draft', 'rejected')
    AND (
      EXISTS (SELECT 1 FROM public.courses c
              WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
      OR (modules.course_id IS NULL AND modules.created_by = auth.uid())
    )
  )
  WITH CHECK (
    public.is_instructor()
    AND public.is_active_user()
    AND modules.status IN ('draft', 'pending_review')
    AND modules.created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.courses c
              WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
      OR (modules.course_id IS NULL AND modules.created_by = auth.uid())
    )
  );

-- ===========================================================================
-- 5. lessons RLS (via owns_module)
-- ===========================================================================
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
    OR (public.is_instructor() AND public.owns_module(lessons.module_id))
  );

DROP POLICY IF EXISTS "lessons_instructor_insert" ON public.lessons;
CREATE POLICY "lessons_instructor_insert" ON public.lessons
  FOR INSERT WITH CHECK (
    public.is_instructor() AND public.is_active_user()
    AND public.owns_module(lessons.module_id)
  );

DROP POLICY IF EXISTS "lessons_instructor_update" ON public.lessons;
CREATE POLICY "lessons_instructor_update" ON public.lessons
  FOR UPDATE
  USING (public.is_instructor() AND public.is_active_user() AND public.owns_module(lessons.module_id))
  WITH CHECK (public.is_instructor() AND public.is_active_user() AND public.owns_module(lessons.module_id));

DROP POLICY IF EXISTS "lessons_instructor_delete" ON public.lessons;
CREATE POLICY "lessons_instructor_delete" ON public.lessons
  FOR DELETE USING (
    public.is_instructor() AND public.is_active_user()
    AND public.owns_module(lessons.module_id)
    AND EXISTS (SELECT 1 FROM public.modules m
                WHERE m.id = lessons.module_id AND m.status IN ('draft', 'rejected'))
  );

-- ===========================================================================
-- 6. resources RLS (via owns_module)
-- ===========================================================================
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
    OR (public.is_instructor() AND public.owns_module(resources.module_id))
  );

DROP POLICY IF EXISTS "resources_instructor_insert" ON public.resources;
CREATE POLICY "resources_instructor_insert" ON public.resources
  FOR INSERT WITH CHECK (
    public.is_instructor() AND public.is_active_user()
    AND public.owns_module(resources.module_id)
  );

DROP POLICY IF EXISTS "resources_instructor_update" ON public.resources;
CREATE POLICY "resources_instructor_update" ON public.resources
  FOR UPDATE
  USING (public.is_instructor() AND public.is_active_user() AND public.owns_module(resources.module_id))
  WITH CHECK (public.is_instructor() AND public.is_active_user() AND public.owns_module(resources.module_id));

DROP POLICY IF EXISTS "resources_instructor_delete" ON public.resources;
CREATE POLICY "resources_instructor_delete" ON public.resources
  FOR DELETE USING (
    public.is_instructor() AND public.is_active_user()
    AND public.owns_module(resources.module_id)
    AND EXISTS (SELECT 1 FROM public.modules m
                WHERE m.id = resources.module_id AND m.status IN ('draft', 'rejected'))
  );

-- ===========================================================================
-- 7. storage.objects RLS — CORRECTION 2: instructor branches via owns_module
--    (LEFT JOIN), enrolled branch keeps inner joins (orphans correctly excluded).
--    The module id is path segment [4]; guard the ::uuid cast with a regex inside
--    a CASE so a malformed path yields owns_module(NULL) -> false, never an error.
--    Orphan objects are stored at courses/unassigned/modules/<module_id>/... so
--    [1]='courses' and [4]=module_id still hold; no path migration, and after an
--    admin assigns the module the object needs no move (policies key on [4]).
-- ===========================================================================
DROP POLICY IF EXISTS "course_materials_enrolled_read" ON storage.objects;
CREATE POLICY "course_materials_enrolled_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-materials'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
        JOIN public.enrollments e ON e.course_id = m.course_id
        WHERE m.id::text = (storage.foldername(name))[4]
          AND m.status = 'published' AND c.is_active = TRUE
          AND e.user_id = auth.uid()
          AND e.status IN ('active', 'completed')
      )
      OR (
        public.is_instructor()
        AND public.owns_module(
          (CASE WHEN (storage.foldername(name))[4] ~ '^[0-9a-fA-F-]{36}$'
                THEN (storage.foldername(name))[4] ELSE NULL END)::uuid
        )
      )
    )
  );

DROP POLICY IF EXISTS "course_materials_instructor_insert" ON storage.objects;
CREATE POLICY "course_materials_instructor_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'course-materials'
    AND public.is_instructor() AND public.is_active_user()
    AND (storage.foldername(name))[1] = 'courses'
    AND public.owns_module(
      (CASE WHEN (storage.foldername(name))[4] ~ '^[0-9a-fA-F-]{36}$'
            THEN (storage.foldername(name))[4] ELSE NULL END)::uuid
    )
    AND EXISTS (SELECT 1 FROM public.modules m
                WHERE m.id::text = (storage.foldername(name))[4]
                  AND m.status IN ('draft', 'rejected'))
  );

DROP POLICY IF EXISTS "course_materials_instructor_update" ON storage.objects;
CREATE POLICY "course_materials_instructor_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'course-materials'
    AND public.is_instructor() AND public.is_active_user()
    AND public.owns_module(
      (CASE WHEN (storage.foldername(name))[4] ~ '^[0-9a-fA-F-]{36}$'
            THEN (storage.foldername(name))[4] ELSE NULL END)::uuid
    )
    AND EXISTS (SELECT 1 FROM public.modules m
                WHERE m.id::text = (storage.foldername(name))[4]
                  AND m.status IN ('draft', 'rejected'))
  )
  WITH CHECK (
    bucket_id = 'course-materials'
    AND public.is_instructor() AND public.is_active_user()
    AND public.owns_module(
      (CASE WHEN (storage.foldername(name))[4] ~ '^[0-9a-fA-F-]{36}$'
            THEN (storage.foldername(name))[4] ELSE NULL END)::uuid
    )
    AND EXISTS (SELECT 1 FROM public.modules m
                WHERE m.id::text = (storage.foldername(name))[4]
                  AND m.status IN ('draft', 'rejected'))
  );

-- course_materials_admin_write (FOR ALL USING/WITH CHECK is_admin()) is unchanged.
