-- 014_notifications.sql
-- In-app notifications for instructors (module approved / rejected / assigned)
-- and learners (certificate issued).
--
-- Creation is TRIGGER-ONLY (mirrors certificates / admin_logs): a client can
-- never INSERT a notification (notifications_no_client_insert WITH CHECK FALSE);
-- rows are written by SECURITY DEFINER triggers on the real mutation paths, so a
-- future code path cannot silently skip notifying by forgetting a helper call.
--
-- Recipient resolution never errors the underlying mutation: if it can't resolve
-- a recipient (COALESCE of the module's submitter/creator is NULL), the trigger
-- simply skips the notification. certificates.user_id is NOT NULL so that case is
-- always resolvable.
--
-- UUID default: gen_random_uuid(), matching the sibling system-write tables
-- (certificates, admin_logs). See HANDOFF — this project has two UUID default
-- lineages and that is intentional, not drift.

-- ===========================================================================
-- 1. Table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN
    ('module_approved', 'module_rejected', 'module_assigned', 'certificate_issued')),
  title text NOT NULL,
  message text NOT NULL,
  link text,                                        -- path to the relevant page
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  certificate_id uuid REFERENCES public.certificates(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 2. RLS — recipient reads + marks-read own rows; NO client insert (trigger-only)
-- ===========================================================================
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_no_client_insert" ON public.notifications;
CREATE POLICY "notifications_no_client_insert" ON public.notifications
  FOR INSERT WITH CHECK (FALSE);
-- (no DELETE policy — clients cannot delete; cascade cleanup handles removal)

-- ===========================================================================
-- 3. Trigger: module approved / rejected / assigned
--    AFTER UPDATE on modules. Coexists with 013's BEFORE UPDATE trigger.
--    Both cases can co-fire (e.g. assign + publish in one update) -> two rows.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_on_module_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipient uuid;
  nlink text;
BEGIN
  -- Review decision: status changed to published or rejected.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('published', 'rejected') THEN
    recipient := COALESCE(NEW.submitted_by, NEW.created_by);
    IF recipient IS NOT NULL THEN
      nlink := CASE
        WHEN NEW.course_id IS NOT NULL
          THEN format('/instructor/courses/%s/modules/%s', NEW.course_id, NEW.id)
          ELSE format('/instructor/modules/%s', NEW.id)
      END;
      IF NEW.status = 'published' THEN
        INSERT INTO public.notifications (user_id, type, title, message, link, module_id)
        VALUES (recipient, 'module_approved', 'Module approved',
                format('Your module "%s" was approved and published.', NEW.title),
                nlink, NEW.id);
      ELSE
        INSERT INTO public.notifications (user_id, type, title, message, link, module_id)
        VALUES (recipient, 'module_rejected', 'Module needs changes',
                format('Your module "%s" was returned.%s', NEW.title,
                  CASE WHEN COALESCE(NEW.review_notes, '') <> ''
                       THEN ' Reviewer note: ' || NEW.review_notes ELSE '' END),
                nlink, NEW.id);
      END IF;
    END IF;
  END IF;

  -- Assignment: course_id went from NULL to a course.
  IF OLD.course_id IS NULL AND NEW.course_id IS NOT NULL THEN
    recipient := COALESCE(NEW.created_by, NEW.submitted_by);
    IF recipient IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link, module_id)
      VALUES (recipient, 'module_assigned', 'Module assigned to a course',
              format('Your module "%s" was assigned to a course.', NEW.title),
              format('/instructor/courses/%s/modules/%s', NEW.course_id, NEW.id),
              NEW.id);
    END IF;
  END IF;

  RETURN NULL; -- AFTER trigger: return value ignored
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_module_change ON public.modules;
CREATE TRIGGER trg_notify_module_change
  AFTER UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_module_change();

-- ===========================================================================
-- 4. Trigger: certificate issued (AFTER INSERT). user_id is NOT NULL -> always
--    resolvable. Only 'active' certificates notify (guards any non-issuance insert).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_on_certificate_issued()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ctitle text;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT title INTO ctitle FROM public.courses WHERE id = NEW.course_id;
    INSERT INTO public.notifications (user_id, type, title, message, link, certificate_id)
    VALUES (NEW.user_id, 'certificate_issued', 'Certificate issued',
            format('Your certificate for "%s" is ready.', COALESCE(ctitle, 'your course')),
            format('/certificates/%s', NEW.id), NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_certificate_issued ON public.certificates;
CREATE TRIGGER trg_notify_certificate_issued
  AFTER INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_certificate_issued();
