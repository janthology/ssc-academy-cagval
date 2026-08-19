-- 011_tighten_course_materials_storage.sql
-- Close the storage-layer hole in the course-materials bucket.
--
-- PROBLEM (confirmed by live probe): the bucket is private, but its
-- storage.objects policies made it effectively open to any logged-in user:
--   * "Allow authenticated SELECT for signed URLs"           SELECT  bucket = course-materials
--   * "Allow authenticated users to download course materials" SELECT bucket = course-materials
--   * "course_materials_enrolled_read"                        SELECT  bucket AND (is_admin() OR auth.uid() IS NOT NULL)
--       (despite the name, it never checked enrollment)
--   * "Allow authenticated users to upload course materials"  INSERT  bucket AND role=authenticated AND foldername[1]='courses'
--       (no ownership check — any authenticated user could write any path)
-- Net effect: any authenticated account could read every course PDF and upload
-- arbitrary files. resources_enrolled_read guards the DB row; the file did not.
--
-- FIX: replace the three overlapping SELECT policies with ONE that mirrors
-- public.resources_enrolled_read's real logic, and scope writes to the course's
-- assigned instructor (admins keep full access via course_materials_admin_write).
--
-- PATH MODEL: objects are stored at
--   courses/<course_id>/modules/<module_id>/material.pdf
-- storage.foldername(name) => ['courses', <course_id>, 'modules', <module_id>]
--   [2] = course_id   [4] = module_id
-- Segments are compared with ::text (not ::uuid) so a malformed path simply
-- fails to match instead of raising a cast error during policy evaluation.

-- ===========================================================================
-- 1. Drop the three permissive course-materials SELECT policies
-- ===========================================================================
DROP POLICY IF EXISTS "Allow authenticated SELECT for signed URLs"        ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to download course materials" ON storage.objects;
DROP POLICY IF EXISTS "course_materials_enrolled_read"                     ON storage.objects;

-- ===========================================================================
-- 2. Single enrollment/ownership-aware SELECT policy
--    (mirrors public.resources_enrolled_read, keyed off the path's module_id)
-- ===========================================================================
CREATE POLICY "course_materials_enrolled_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-materials'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
        JOIN public.enrollments e ON e.course_id = m.course_id
        WHERE m.id::text = (storage.foldername(name))[4]
          AND m.status = 'published' AND c.is_active = TRUE
          AND e.user_id = auth.uid()
          AND e.status IN ('active', 'completed')
      )
      OR EXISTS (
        SELECT 1 FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
        WHERE m.id::text = (storage.foldername(name))[4]
          AND public.is_instructor() AND c.instructor_id = auth.uid()
      )
    )
  );

-- ===========================================================================
-- 3. Replace the loose INSERT with owner-scoped INSERT + UPDATE, frozen while
--    the module is under review.
--    UPDATE is required because the editor uploads with upsert=true (replacing
--    a module's PDF overwrites the same material.pdf path). Ownership + status
--    are resolved through the path's module id ([4]) joined to its course,
--    mirroring the read policy. status IN ('draft','rejected') applies the same
--    review freeze 009 put on module/lesson edits: an instructor cannot swap the
--    PDF bytes while an admin is reviewing (pending_review) or after publish.
--    Admins are unaffected (course_materials_admin_write is FOR ALL is_admin()).
-- ===========================================================================
DROP POLICY IF EXISTS "Allow authenticated users to upload course materials" ON storage.objects;

CREATE POLICY "course_materials_instructor_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'course-materials'
    AND public.is_instructor()
    AND public.is_active_user()
    AND (storage.foldername(name))[1] = 'courses'
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id::text = (storage.foldername(name))[4]
        AND c.instructor_id = auth.uid()
        AND m.status IN ('draft', 'rejected')
    )
  );

CREATE POLICY "course_materials_instructor_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'course-materials'
    AND public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id::text = (storage.foldername(name))[4]
        AND c.instructor_id = auth.uid()
        AND m.status IN ('draft', 'rejected')
    )
  )
  WITH CHECK (
    bucket_id = 'course-materials'
    AND public.is_instructor()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id::text = (storage.foldername(name))[4]
        AND c.instructor_id = auth.uid()
        AND m.status IN ('draft', 'rejected')
    )
  );

-- course_materials_admin_write (FOR ALL USING/ WITH CHECK is_admin()) is kept
-- exactly as-is: it already covers admin insert/update/delete/select.

-- ===========================================================================
-- 4. Bucket hardening — cap size and restrict type (currently both NULL).
--    Only PDFs are ever stored here; the largest real object is ~9 MB.
-- ===========================================================================
UPDATE storage.buckets
SET file_size_limit   = 52428800,                      -- 50 MB
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'course-materials';
