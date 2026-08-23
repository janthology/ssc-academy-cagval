-- 019_verify_certificate_rpc.sql
-- Public certificate verification without service-role or table SELECT.
--
-- Migration 004 removed anon SELECT on certificates and documented that
-- GET /api/certificates/verify/[id] would use the service role. That path
-- fails when SUPABASE_SERVICE_ROLE_KEY is missing/rotated, and PostgREST
-- embeds (course:courses / user:users) can also 500 if live FKs differ.
--
-- This SECURITY DEFINER function returns ONLY safe public fields. Callable
-- by anon/authenticated. Never exposes grade, organization, hash, or email.

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
BEGIN
  SELECT
    c.status::text AS status,
    c.issued_at,
    c.certificate_number,
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

  status := 'valid';
  recipient_name := COALESCE(cert.recipient_name, 'Unknown Recipient');
  course_title := COALESCE(cert.course_title, 'Unknown Course');
  completion_date := cert.issued_at;
  certificate_number := cert.certificate_number;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(uuid) TO anon, authenticated;
