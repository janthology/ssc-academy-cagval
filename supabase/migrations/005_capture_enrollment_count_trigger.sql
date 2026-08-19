-- 005_capture_enrollment_count_trigger.sql
-- Captures the enrollment_count maintenance trigger that ALREADY EXISTS on the
-- live database but was created outside version control. Recorded verbatim so a
-- fresh deployment from these migrations reproduces the same behavior (without
-- it, enrollment_count would stay 0 on a new project).
--
-- Idempotent and safe to re-apply to the live DB: CREATE OR REPLACE on the
-- function is a no-op if unchanged, and DROP TRIGGER IF EXISTS + CREATE replaces
-- the identically-named trigger rather than adding a second one (a duplicate
-- would double-count).
--
-- Behavior: AFTER INSERT/DELETE on enrollments, adjusts courses.enrollment_count
-- for 'active' enrollments only, decrement floored at 0. It intentionally does
-- NOT handle UPDATE, so an active<->dropped status change does not adjust the
-- count — captured as-is to match live. Enrollment in the app goes through the
-- SECURITY DEFINER enroll_and_track_progress RPC, whose owner context lets this
-- trigger's UPDATE on courses run despite courses being admin-only under RLS.

CREATE OR REPLACE FUNCTION public.update_enrollment_count()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only increment for 'active' enrollments
    IF NEW.status = 'active' THEN
      UPDATE courses
      SET enrollment_count = courses.enrollment_count + 1
      WHERE courses.id = NEW.course_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Only decrement if the deleted enrollment was 'active'
    IF OLD.status = 'active' THEN
      UPDATE courses
      SET enrollment_count = GREATEST(enrollment_count - 1, 0)  -- Prevent negative
      WHERE courses.id = OLD.course_id;
    END IF;
  END IF;

  -- Always return NULL for AFTER triggers
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_update_enrollment_count ON public.enrollments;
CREATE TRIGGER trigger_update_enrollment_count
  AFTER INSERT OR DELETE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_enrollment_count();
