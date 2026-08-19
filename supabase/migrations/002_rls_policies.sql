-- Row Level Security policies for Smart City Academy
-- Safe to apply on existing databases (adds missing columns/enums first).

-- ---------------------------------------------------------------------------
-- Patch existing schema (run before helper functions)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'active';

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'active' FROM public.users WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learningoutcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learningpaths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learningpath_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "users_admin_all" ON public.users;
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- courses & content (public read for active, admin write)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "courses_public_read" ON public.courses;
CREATE POLICY "courses_public_read" ON public.courses
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "courses_admin_write" ON public.courses;
CREATE POLICY "courses_admin_write" ON public.courses
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "modules_public_read" ON public.modules;
CREATE POLICY "modules_public_read" ON public.modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = modules.course_id AND (c.is_active = TRUE OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "modules_admin_write" ON public.modules;
CREATE POLICY "modules_admin_write" ON public.modules
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "lessons_public_read" ON public.lessons;
CREATE POLICY "lessons_public_read" ON public.lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND (c.is_active = TRUE OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "lessons_admin_write" ON public.lessons;
CREATE POLICY "lessons_admin_write" ON public.lessons
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "resources_enrolled_read" ON public.resources;
CREATE POLICY "resources_enrolled_read" ON public.resources
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.enrollments e ON e.course_id = m.course_id
      WHERE m.id = resources.module_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "resources_admin_write" ON public.resources;
CREATE POLICY "resources_admin_write" ON public.resources
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "learningoutcomes_public_read" ON public.learningoutcomes;
CREATE POLICY "learningoutcomes_public_read" ON public.learningoutcomes
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "learningoutcomes_admin_write" ON public.learningoutcomes;
CREATE POLICY "learningoutcomes_admin_write" ON public.learningoutcomes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- learning paths
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "learningpaths_public_read" ON public.learningpaths;
CREATE POLICY "learningpaths_public_read" ON public.learningpaths
  FOR SELECT USING (status = 'active' OR public.is_admin());

DROP POLICY IF EXISTS "learningpaths_admin_write" ON public.learningpaths;
CREATE POLICY "learningpaths_admin_write" ON public.learningpaths
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "learningpath_courses_public_read" ON public.learningpath_courses;
CREATE POLICY "learningpath_courses_public_read" ON public.learningpath_courses
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "learningpath_courses_admin_write" ON public.learningpath_courses;
CREATE POLICY "learningpath_courses_admin_write" ON public.learningpath_courses
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- enrollments & progress
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "enrollments_select_own" ON public.enrollments;
CREATE POLICY "enrollments_select_own" ON public.enrollments
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "enrollments_insert_own" ON public.enrollments;
CREATE POLICY "enrollments_insert_own" ON public.enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_active_user());

DROP POLICY IF EXISTS "enrollments_update_own" ON public.enrollments;
CREATE POLICY "enrollments_update_own" ON public.enrollments
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "progress_select_own" ON public.progress;
CREATE POLICY "progress_select_own" ON public.progress
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "progress_insert_own" ON public.progress;
CREATE POLICY "progress_insert_own" ON public.progress
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_active_user());

DROP POLICY IF EXISTS "progress_update_own" ON public.progress;
CREATE POLICY "progress_update_own" ON public.progress
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "certificates_select_own" ON public.certificates;
CREATE POLICY "certificates_select_own" ON public.certificates
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR status = 'active'  -- allows public verification lookups
  );

-- Inserts only via service role (server API route)
DROP POLICY IF EXISTS "certificates_no_client_insert" ON public.certificates;
CREATE POLICY "certificates_no_client_insert" ON public.certificates
  FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "certificates_admin_update" ON public.certificates;
CREATE POLICY "certificates_admin_update" ON public.certificates
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "organizations_authenticated_read" ON public.organizations;
CREATE POLICY "organizations_authenticated_read" ON public.organizations
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "organizations_admin_write" ON public.organizations;
CREATE POLICY "organizations_admin_write" ON public.organizations
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- admin_logs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "admin_logs_admin_read" ON public.admin_logs;
CREATE POLICY "admin_logs_admin_read" ON public.admin_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_logs_no_client_write" ON public.admin_logs;
CREATE POLICY "admin_logs_no_client_write" ON public.admin_logs
  FOR INSERT WITH CHECK (FALSE);

-- ---------------------------------------------------------------------------
-- Storage policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "course_materials_enrolled_read" ON storage.objects;
CREATE POLICY "course_materials_enrolled_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-materials'
    AND (
      public.is_admin()
      OR auth.uid() IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "course_materials_admin_write" ON storage.objects;
CREATE POLICY "course_materials_admin_write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'course-materials' AND public.is_admin()
  ) WITH CHECK (
    bucket_id = 'course-materials' AND public.is_admin()
  );

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_own_write" ON storage.objects;
CREATE POLICY "avatars_own_write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]
  ) WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- Required RPC functions (for existing databases)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.enrollment_status AS ENUM ('active', 'completed', 'dropped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS progress_user_course_lesson_idx
  ON public.progress (user_id, course_id, lesson_id);

-- Remove duplicate overloads; keep single (jsonb, jsonb) signature for Supabase JS client
DROP FUNCTION IF EXISTS public.enroll_and_track_progress(jsonb, jsonb[]);
DROP FUNCTION IF EXISTS public.enroll_and_track_progress(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.enroll_and_track_progress(
  enrollment_input JSONB,
  progress_inputs JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_enrollment public.enrollments%ROWTYPE;
  progress_item JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF (enrollment_input->>'user_id')::UUID <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot enroll on behalf of another user';
  END IF;

  INSERT INTO public.enrollments (
    user_id,
    course_id,
    status,
    progress,
    enrolled_at,
    last_accessed_at
  )
  VALUES (
    (enrollment_input->>'user_id')::UUID,
    (enrollment_input->>'course_id')::UUID,
    COALESCE(enrollment_input->>'status', 'active'),
    COALESCE((enrollment_input->>'progress')::INTEGER, 0),
    COALESCE((enrollment_input->>'enrolled_at')::TIMESTAMPTZ, NOW()),
    COALESCE((enrollment_input->>'last_accessed_at')::TIMESTAMPTZ, NOW())
  )
  RETURNING * INTO new_enrollment;

  FOR progress_item IN SELECT * FROM jsonb_array_elements(progress_inputs)
  LOOP
    INSERT INTO public.progress (
      user_id,
      course_id,
      module_id,
      lesson_id,
      completed,
      completed_at,
      time_spent
    )
    VALUES (
      (progress_item->>'user_id')::UUID,
      (progress_item->>'course_id')::UUID,
      (progress_item->>'module_id')::UUID,
      (progress_item->>'lesson_id')::UUID,
      COALESCE((progress_item->>'completed')::BOOLEAN, FALSE),
      (progress_item->>'completed_at')::TIMESTAMPTZ,
      COALESCE((progress_item->>'time_spent')::INTEGER, 0)
    )
    ON CONFLICT (user_id, course_id, lesson_id) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('enrollment_id', new_enrollment.id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grant RPC execute to authenticated users
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.enroll_and_track_progress(JSONB, JSONB) TO authenticated;
