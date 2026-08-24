-- 022_admin_notifications_assign.sql
-- P2: notify all admins when a published module has no course (assign queue).
--
-- Matches /admin/assign: status = published AND course_id IS NULL.
-- Fans out one row per is_admin (excludes the reviewing admin when known).

-- ===========================================================================
-- 1. Widen notifications.type CHECK to allow module_needs_assignment
-- ===========================================================================
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'notifications'
      AND c.contype = 'c'
      AND (
        pg_get_constraintdef(c.oid) ILIKE '%type%'
        OR c.conname ILIKE '%type%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'module_approved',
    'module_rejected',
    'module_assigned',
    'certificate_issued',
    'module_submitted',
    'module_needs_assignment'
  ));

-- ===========================================================================
-- 2. Trigger: published orphan module → notify admins
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_admins_on_orphan_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
BEGIN
  -- Eligible for /admin/assign: published and unassigned.
  IF NOT (NEW.status = 'published' AND NEW.course_id IS NULL) THEN
    RETURN NULL;
  END IF;

  -- Only when the row newly enters that state (publish, or course cleared).
  IF NOT (
    (NEW.status IS DISTINCT FROM OLD.status)
    OR (NEW.course_id IS DISTINCT FROM OLD.course_id)
  ) THEN
    RETURN NULL;
  END IF;

  actor_id := COALESCE(NEW.reviewed_by, NEW.submitted_by, NEW.created_by);

  INSERT INTO public.notifications (user_id, type, title, message, link, module_id)
  SELECT
    u.id,
    'module_needs_assignment',
    'Module needs course assignment',
    format('"%s" is published but not assigned to a course.', NEW.title),
    '/admin/assign',
    NEW.id
  FROM public.users u
  WHERE u.is_admin = TRUE
    AND (actor_id IS NULL OR u.id IS DISTINCT FROM actor_id);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_orphan_published ON public.modules;
CREATE TRIGGER trg_notify_admins_orphan_published
  AFTER UPDATE ON public.modules
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_orphan_published();
