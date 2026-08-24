-- 023_admin_notifications_user_pending.sql
-- P1 Layer B: notify admins when a user is awaiting approval (status = pending).
--
-- Companion app changes: register inserts status='pending'; login rejects
-- pending/inactive accounts.

-- ===========================================================================
-- 1. Widen notifications.type CHECK to allow user_pending
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
    'module_needs_assignment',
    'user_pending'
  ));

-- ===========================================================================
-- 2. Trigger: pending user → notify admins
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_admins_on_user_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT of a pending user, or transition into pending.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RETURN NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT (
      NEW.status = 'pending'
      AND NEW.status IS DISTINCT FROM OLD.status
    ) THEN
      RETURN NULL;
    END IF;
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT
    u.id,
    'user_pending',
    'New user awaiting approval',
    format('%s (%s) registered and is awaiting approval.', NEW.name, NEW.email),
    '/admin/users'
  FROM public.users u
  WHERE u.is_admin = TRUE;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_user_pending_ins ON public.users;
CREATE TRIGGER trg_notify_admins_user_pending_ins
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_user_pending();

DROP TRIGGER IF EXISTS trg_notify_admins_user_pending_upd ON public.users;
CREATE TRIGGER trg_notify_admins_user_pending_upd
  AFTER UPDATE OF status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_user_pending();
