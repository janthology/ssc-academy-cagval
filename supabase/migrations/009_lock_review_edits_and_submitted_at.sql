-- 009_lock_review_edits_and_submitted_at.sql
-- Small, contained addition on top of 008.
--
-- 1. modules.submitted_at — timestamp of submit-for-review. Nullable, no backfill:
--    the 23 pre-existing modules are 'published' and never went through the
--    review workflow, so NULL is the correct value for them.
--
-- 2. Lock content edits while a module is under review. 008's
--    modules_instructor_update USING clause checked ownership only, so an
--    instructor could keep editing a module already sitting in an admin's review
--    queue (status='pending_review') — the admin would be reviewing a moving
--    target. USING now additionally requires the CURRENT status to be
--    'draft' or 'rejected'.
--
--    WITH CHECK is unchanged from 008 (it restricts the RESULTING status to
--    'draft'/'pending_review' and remains the escalation guard). In an UPDATE
--    policy, USING is evaluated against the OLD row and WITH CHECK against the
--    NEW row.
--
--    CONSEQUENCE: an instructor can no longer withdraw their own submission
--    (pending_review -> draft). Moving a module out of pending_review is an
--    admin action only, via modules_admin_write.

-- ===========================================================================
-- 1. Submission timestamp
-- ===========================================================================
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- ===========================================================================
-- 2. Freeze instructor edits during review
-- ===========================================================================
DROP POLICY IF EXISTS "modules_instructor_update" ON public.modules;
CREATE POLICY "modules_instructor_update" ON public.modules
  FOR UPDATE USING (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (SELECT 1 FROM public.courses c
                WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
    AND modules.status IN ('draft', 'rejected')          -- under-review lock
  )
  WITH CHECK (
    public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (SELECT 1 FROM public.courses c
                WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
    AND modules.status IN ('draft', 'pending_review')     -- escalation guard
  );
