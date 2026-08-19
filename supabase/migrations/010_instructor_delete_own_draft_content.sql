-- 010_instructor_delete_own_draft_content.sql
-- Instructors need to be able to REMOVE a section from a module they are still
-- editing. 008 granted instructors INSERT/UPDATE only, with no DELETE, which
-- makes the section list append-only: a delete silently matches zero rows under
-- RLS, so a save that rewrites the lesson list duplicates it instead of
-- replacing it.
--
-- Scope is deliberately narrower than the instructor write policies:
--   * own course only (course.instructor_id = auth.uid()), and
--   * only while the parent module is 'draft' or 'rejected'.
-- Once a module is pending_review or published, instructors cannot delete its
-- content — consistent with the 009 edit lock. Admins are unaffected; they keep
-- full access via the existing *_admin_write policies.

-- ===========================================================================
-- lessons
-- ===========================================================================
DROP POLICY IF EXISTS "lessons_instructor_delete" ON public.lessons;
CREATE POLICY "lessons_instructor_delete" ON public.lessons
  FOR DELETE USING (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id
        AND c.instructor_id = auth.uid()
        AND m.status IN ('draft', 'rejected')
    )
  );

-- ===========================================================================
-- resources — same rule, so a replaced PDF does not leave an orphan row
-- ===========================================================================
DROP POLICY IF EXISTS "resources_instructor_delete" ON public.resources;
CREATE POLICY "resources_instructor_delete" ON public.resources
  FOR DELETE USING (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = resources.module_id
        AND c.instructor_id = auth.uid()
        AND m.status IN ('draft', 'rejected')
    )
  );
