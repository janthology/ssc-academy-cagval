-- 021_admin_notifications.sql
-- P0: notify all admins when a module is submitted for review.
--
-- Extends the trigger-only notification model from 014. Fans out one row per
-- is_admin user so existing RLS + NotificationBell work unchanged. Does not
-- notify the submitting instructor (they already know); other admins get the ping.

-- ===========================================================================
-- 1. Widen notifications.type CHECK to allow module_submitted
-- ===========================================================================
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'notifications'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%type%IN%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'module_approved',
    'module_rejected',
    'module_assigned',
    'certificate_issued',
    'module_submitted'
  ));

-- ===========================================================================
-- 2. Trigger: module submitted for review → notify admins
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_admins_on_module_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  submitter_name text;
  submitter_id uuid;
BEGIN
  IF NOT (
    NEW.status = 'pending_review'
    AND NEW.status IS DISTINCT FROM OLD.status
  ) THEN
    RETURN NULL;
  END IF;

  submitter_id := COALESCE(NEW.submitted_by, NEW.created_by);

  IF submitter_id IS NOT NULL THEN
    SELECT name INTO submitter_name FROM public.users WHERE id = submitter_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, module_id)
  SELECT
    u.id,
    'module_submitted',
    'Module submitted for review',
    format(
      '%s submitted "%s" for review.',
      COALESCE(submitter_name, 'An instructor'),
      NEW.title
    ),
    format('/admin/review/%s', NEW.id),
    NEW.id
  FROM public.users u
  WHERE u.is_admin = TRUE
    AND (submitter_id IS NULL OR u.id IS DISTINCT FROM submitter_id);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_module_submit ON public.modules;
CREATE TRIGGER trg_notify_admins_module_submit
  AFTER UPDATE ON public.modules
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_module_submit();
