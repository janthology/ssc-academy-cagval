-- 003_tighten_rls_from_audit.sql
-- Removes out-of-version-control dashboard policies that leak data or allow
-- privilege escalation, and closes the is_admin column-escalation path.
-- The correctly-scoped snake_case policies from 002 remain and provide access.
--
-- Findings addressed (see QA audit): #1 users PII public read, #2 certificates
-- public read of non-active rows, #3 unrestricted user insert + is_admin
-- self-escalation (insert AND update paths), #4 loose courses UPDATE grants,
-- #5 owner UPDATE/DELETE of own certificate.

-- ===== users =====
-- Leak #1: full-table public read (PII + is_admin)
DROP POLICY IF EXISTS "Allow public read for email check" ON public.users;
-- Escalation #3: unrestricted insert (any id, is_admin=true)
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.users;
-- Redundant duplicates of users_select_own / users_update_own (out-of-repo noise)
DROP POLICY IF EXISTS "Allow authenticated users to read own data" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to read own profile" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
-- super_admin jwt claim is unused anywhere in the app; redundant with users_admin_all
DROP POLICY IF EXISTS "Admins full access to users" ON public.users;

-- Close is_admin escalation on the IN-REPO policies (column guard).
-- Non-admins may write their own row but may NOT set is_admin true;
-- real admin promotion still works via users_admin_all (is_admin()).
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id AND is_admin IS NOT TRUE);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK ((auth.uid() = id OR public.is_admin()) AND (is_admin IS NOT TRUE OR public.is_admin()));

-- ===== certificates =====
DROP POLICY IF EXISTS "Allow public read of certificates" ON public.certificates;                   -- leak #2
DROP POLICY IF EXISTS "Allow authenticated users to read own certificates" ON public.certificates;  -- #5 (FOR ALL -> owner tamper/delete)
DROP POLICY IF EXISTS "Admins full access to certificates" ON public.certificates;                  -- super_admin jwt; redundant

-- ===== courses =====
DROP POLICY IF EXISTS "Allow authenticated update on courses" ON public.courses;                    -- #4 any auth user edits any course
DROP POLICY IF EXISTS "Allow authenticated update enrollment_count on courses" ON public.courses;   -- #4
DROP POLICY IF EXISTS "Allow authenticated update on courses enrollment_count" ON public.courses;   -- #4
DROP POLICY IF EXISTS "Allow public read for courses" ON public.courses;                            -- dup of courses_public_read, exposes inactive
DROP POLICY IF EXISTS "Admins full access to courses" ON public.courses;                            -- super_admin jwt; redundant
