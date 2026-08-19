-- 007_enrollments_unique_user_course.sql
-- Adds the UNIQUE(user_id, course_id) constraint that 001 specified but the live
-- database was missing (confirmed schema drift in the Phase 3 dump). Without it,
-- duplicate enrollments are possible, and each duplicate fires the
-- update_enrollment_count trigger again, inflating courses.enrollment_count.
--
-- Step 3.1b confirmed ZERO existing duplicate (user_id, course_id) pairs, so this
-- constraint applies cleanly with no dedup needed. Idempotent: only adds the
-- constraint if it is not already present. Non-destructive (no data changed).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.enrollments'::regclass
      AND conname = 'enrollments_user_id_course_id_key'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_user_id_course_id_key UNIQUE (user_id, course_id);
  END IF;
END $$;
