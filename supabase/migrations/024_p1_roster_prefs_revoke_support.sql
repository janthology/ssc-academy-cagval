-- 024_p1_roster_prefs_revoke_support.sql
-- Platform P1 (items 1–3 support):
--   * Instructor can SELECT enrollments/progress/users for owned courses (roster)
--   * user_preferences table + RLS
--   * Gate certificate_issued notify + public verify + team progress on prefs
-- Certificate revoke itself is an admin UPDATE (already allowed by RLS); no DDL.

-- ===========================================================================
-- 1. Instructor roster RLS
-- ===========================================================================
DROP POLICY IF EXISTS "enrollments_select_as_instructor" ON public.enrollments;
CREATE POLICY "enrollments_select_as_instructor" ON public.enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = enrollments.course_id
        AND c.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "progress_select_as_instructor" ON public.progress;
CREATE POLICY "progress_select_as_instructor" ON public.progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = progress.course_id
        AND c.instructor_id = auth.uid()
    )
  );

-- Allow instructors to read basic profile fields of learners enrolled in their courses.
DROP POLICY IF EXISTS "users_select_enrolled_in_my_courses" ON public.users;
CREATE POLICY "users_select_enrolled_in_my_courses" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.courses c ON c.id = e.course_id
      WHERE e.user_id = users.id
        AND c.instructor_id = auth.uid()
    )
  );

-- ===========================================================================
-- 2. user_preferences
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  notify_course_updates boolean NOT NULL DEFAULT true,
  notify_certificates boolean NOT NULL DEFAULT true,
  notify_team_activity boolean NOT NULL DEFAULT true,
  notify_event_reminders boolean NOT NULL DEFAULT true,
  notify_marketing boolean NOT NULL DEFAULT false,
  privacy_profile_visibility boolean NOT NULL DEFAULT true,
  privacy_progress_sharing boolean NOT NULL DEFAULT true,
  privacy_certificate_verification boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_update_own" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===========================================================================
-- 3. Gate certificate_issued notification on notify_certificates (default true)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_on_certificate_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctitle text;
  wants_notify boolean;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT COALESCE(p.notify_certificates, true)
      INTO wants_notify
      FROM public.user_preferences p
     WHERE p.user_id = NEW.user_id;

    IF wants_notify IS NULL THEN
      wants_notify := true;
    END IF;

    IF wants_notify THEN
      SELECT title INTO ctitle FROM public.courses WHERE id = NEW.course_id;
      INSERT INTO public.notifications (user_id, type, title, message, link, certificate_id)
      VALUES (
        NEW.user_id,
        'certificate_issued',
        'Certificate issued',
        format('Your certificate for "%s" is ready.', COALESCE(ctitle, 'your course')),
        format('/certificates/%s', NEW.id),
        NEW.id
      );
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- ===========================================================================
-- 4. Public verify respects privacy_certificate_verification (default true)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.verify_certificate(p_id uuid)
RETURNS TABLE (
  status text,
  recipient_name text,
  course_title text,
  completion_date timestamptz,
  certificate_number text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cert record;
  allow_public boolean;
BEGIN
  SELECT
    c.status::text AS status,
    c.issued_at,
    c.certificate_number,
    c.user_id,
    u.name AS recipient_name,
    co.title AS course_title
  INTO cert
  FROM public.certificates c
  LEFT JOIN public.users u ON u.id = c.user_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  WHERE c.id = p_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF cert.status = 'revoked' THEN
    status := 'revoked';
    recipient_name := NULL;
    course_title := NULL;
    completion_date := NULL;
    certificate_number := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF cert.status <> 'active' THEN
    RETURN;
  END IF;

  SELECT COALESCE(p.privacy_certificate_verification, true)
    INTO allow_public
    FROM public.user_preferences p
   WHERE p.user_id = cert.user_id;

  IF allow_public IS NULL THEN
    allow_public := true;
  END IF;

  IF NOT allow_public THEN
    RETURN;
  END IF;

  status := 'valid';
  recipient_name := COALESCE(cert.recipient_name, 'Unknown Recipient');
  course_title := COALESCE(cert.course_title, 'Unknown Course');
  completion_date := cert.issued_at;
  certificate_number := cert.certificate_number;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_certificate_lookup(p_ref text)
RETURNS TABLE (
  status text,
  recipient_name text,
  course_title text,
  completion_date timestamptz,
  certificate_number text,
  certificate_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cert record;
  v_id uuid;
  v_ref text := nullif(trim(p_ref), '');
  allow_public boolean;
BEGIN
  IF v_ref IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    v_id := v_ref::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_id := NULL;
  END;

  IF v_id IS NOT NULL THEN
    SELECT
      c.id,
      c.status::text AS status,
      c.issued_at,
      c.certificate_number,
      c.user_id,
      u.name AS recipient_name,
      co.title AS course_title
    INTO cert
    FROM public.certificates c
    LEFT JOIN public.users u ON u.id = c.user_id
    LEFT JOIN public.courses co ON co.id = c.course_id
    WHERE c.id = v_id;
  ELSE
    SELECT
      c.id,
      c.status::text AS status,
      c.issued_at,
      c.certificate_number,
      c.user_id,
      u.name AS recipient_name,
      co.title AS course_title
    INTO cert
    FROM public.certificates c
    LEFT JOIN public.users u ON u.id = c.user_id
    LEFT JOIN public.courses co ON co.id = c.course_id
    WHERE lower(c.certificate_number) = lower(v_ref);
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF cert.status = 'revoked' THEN
    status := 'revoked';
    recipient_name := NULL;
    course_title := NULL;
    completion_date := NULL;
    certificate_number := NULL;
    certificate_id := cert.id;
    RETURN NEXT;
    RETURN;
  END IF;

  IF cert.status <> 'active' THEN
    RETURN;
  END IF;

  SELECT COALESCE(p.privacy_certificate_verification, true)
    INTO allow_public
    FROM public.user_preferences p
   WHERE p.user_id = cert.user_id;

  IF allow_public IS NULL THEN
    allow_public := true;
  END IF;

  IF NOT allow_public THEN
    RETURN;
  END IF;

  status := 'valid';
  recipient_name := COALESCE(cert.recipient_name, 'Unknown Recipient');
  course_title := COALESCE(cert.course_title, 'Unknown Course');
  completion_date := cert.issued_at;
  certificate_number := cert.certificate_number;
  certificate_id := cert.id;
  RETURN NEXT;
END;
$$;

-- ===========================================================================
-- 5. Team progress respects privacy_progress_sharing (default true)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_my_team_progress()
RETURNS TABLE (
  member_id         uuid,
  member_name       text,
  member_position   text,
  enrollments_count integer,
  completed_count   integer,
  progress_sum      integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.name,
    u.position,
    COUNT(e.id)::int,
    COUNT(e.id) FILTER (WHERE e.status = 'completed')::int,
    COALESCE(SUM(e.progress), 0)::int
  FROM public.users u
  LEFT JOIN public.enrollments e ON e.user_id = u.id
  LEFT JOIN public.user_preferences p ON p.user_id = u.id
  WHERE u.status = 'active'
    AND u.organization_id IS NOT NULL
    AND u.organization_id = (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
    AND (
      u.id = auth.uid()
      OR COALESCE(p.privacy_progress_sharing, true)
    )
  GROUP BY u.id, u.name, u.position
  ORDER BY u.name;
$$;
