-- ===========================================================================
-- 018_tighten_learning_path_rls.sql
--
-- Removes EIGHT undocumented RLS policies (four per table) that no migration
-- in this repo ever created, and tightens learningpath_courses reads to follow
-- the parent path's status.
--
-- HOW THIS WAS FOUND
-- Building the learning-path admin UI added a Status control promising
-- "Archived — hidden from learners". The 017 test run then failed one check:
-- an archived path was readable by an authenticated non-admin AND by anon,
-- despite 002 declaring
--     learningpaths_public_read  USING (status = 'active' OR is_admin())
-- RLS was verifiably ENABLED (an anon INSERT returned 42501) and the write
-- policies behaved correctly, so the machinery was live — the read leak came
-- from an extra permissive policy ORing with the correct one. A pg_policies
-- query confirmed four undocumented policies on EACH table.
--
-- WHAT THE UNDOCUMENTED POLICIES DID
--   "Enable read access for all users"
--       Read leak. ORs with *_public_read and defeats its status='active'
--       condition entirely. This is what exposed archived paths, and (on
--       learningpath_courses) their course links — a PostgREST embed returned
--       the archived parent's title and status to anonymous callers.
--   "Enable update for creator" / "Enable delete for creator"
--       Write persistence bug. Keyed on created_by only (on the child table,
--       via a join to the parent's created_by), never re-checking is_admin().
--       A user demoted out of admin therefore kept UPDATE and DELETE rights
--       on every learning path they had ever created, permanently.
--   "Admins full access to learningpath[s|_courses]"
--       Dead. Asserts a super_admin JWT claim this project does not issue —
--       the same class of policy removed in 003 and 008.
--
-- WHAT IS DELIBERATELY LEFT ALONE
--   learningpaths_public_read      — already correct
--   learningpaths_admin_write      — already correct
--   learningpath_courses_admin_write — already correct, and now the ONLY thing
--       authorising admin writes on that table. Verified live after applying:
--       a full admin CRUD round-trip (create with ordered links, edit reorder
--       = delete + re-insert, delete) succeeds, so the dropped creator
--       policies were carrying nothing.
--
-- POST-APPLY REGRESSION: 31/31 passed — archived hidden from learner and anon
-- (visible to admin), archived links and embed no longer resolve, the real
-- active path and its 3 links still readable by anon and learner on both
-- /dashboard/learningpaths and public /learning-paths, admin CRUD intact,
-- non-admin writes denied on both tables.
--
-- APPLIED IN 2 CHUNKS, IN ORDER.
-- ===========================================================================


-- ===========================================================================
-- CHUNK 1 of 2 — learningpaths
-- ===========================================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.learningpaths;
DROP POLICY IF EXISTS "Enable update for creator" ON public.learningpaths;
DROP POLICY IF EXISTS "Enable delete for creator" ON public.learningpaths;
DROP POLICY IF EXISTS "Admins full access to learningpaths" ON public.learningpaths;


-- ===========================================================================
-- CHUNK 2 of 2 — learningpath_courses
--
-- Same four undocumented policies, plus a tightening of the documented read
-- policy. 002 declared learningpath_courses_public_read as USING (TRUE), which
-- was by design — but once the parent hides archived paths, leaving the child
-- fully public still reveals that an archived path exists and exactly which
-- courses it contains. The child now follows the parent, mirroring
-- resources_enrolled_read (013): admin bypass, otherwise EXISTS through the
-- owning table.
--
-- Note the column is learningpath_id, NOT learning_path_id (001 declares the
-- latter; live differs — see migration 006).
-- ===========================================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.learningpath_courses;
DROP POLICY IF EXISTS "Enable update for creator" ON public.learningpath_courses;
DROP POLICY IF EXISTS "Enable delete for creator" ON public.learningpath_courses;
DROP POLICY IF EXISTS "Admins full access to learningpath_courses" ON public.learningpath_courses;

DROP POLICY IF EXISTS "learningpath_courses_public_read" ON public.learningpath_courses;
CREATE POLICY "learningpath_courses_public_read" ON public.learningpath_courses
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.learningpaths lp
      WHERE lp.id = learningpath_courses.learningpath_id
        AND lp.status = 'active'
    )
  );


-- ===========================================================================
-- VERIFICATION (read-only). Expect exactly four rows:
--   learningpaths            learningpaths_admin_write
--   learningpaths            learningpaths_public_read
--   learningpath_courses     learningpath_courses_admin_write
--   learningpath_courses     learningpath_courses_public_read
-- ===========================================================================
-- SELECT tablename, policyname, cmd, qual FROM pg_policies
-- WHERE tablename IN ('learningpaths', 'learningpath_courses')
-- ORDER BY tablename, policyname;
