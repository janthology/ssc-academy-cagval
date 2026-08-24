-- 020_verify_certificate_lookup.sql
-- Guest lookup by certificate UUID or printed certificate_number.
-- Complements 019 verify_certificate(uuid) used by deep links.

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

  status := 'valid';
  recipient_name := COALESCE(cert.recipient_name, 'Unknown Recipient');
  course_title := COALESCE(cert.course_title, 'Unknown Course');
  completion_date := cert.issued_at;
  certificate_number := cert.certificate_number;
  certificate_id := cert.id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate_lookup(text) TO anon, authenticated;
