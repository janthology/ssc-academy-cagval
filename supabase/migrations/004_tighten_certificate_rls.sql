-- 004_tighten_certificate_rls.sql
-- Removes the public status='active' carve-out from certificates_select_own so
-- certificate rows are readable ONLY by their owner or an admin. Public
-- certificate verification is served instead by GET /api/certificates/verify/[id],
-- a server route using the service role key that returns a minimal, safe field
-- set (recipient name, course title, completion date, valid/revoked status) —
-- never grade or other sensitive data.
--
-- Depends on 003 having already dropped the separate "Allow public read of
-- certificates" (qual=true) policy. After this migration, no anon SELECT path
-- to the certificates table remains.

DROP POLICY IF EXISTS "certificates_select_own" ON public.certificates;
CREATE POLICY "certificates_select_own" ON public.certificates
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
