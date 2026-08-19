-- Cagayan Valley Smart City Academy — initial schema
-- Apply to a fresh Supabase project, or review carefully before applying to existing DB.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.user_type AS ENUM (
    'individual', 'lgu', 'suc', 'hei', 'dost', 'government'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.course_level AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lesson_type AS ENUM ('video', 'text', 'quiz', 'assignment', 'pdf');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.resource_type AS ENUM ('pdf', 'video', 'link', 'document');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.enrollment_status AS ENUM ('active', 'completed', 'dropped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.certificate_status AS ENUM ('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.learning_path_status AS ENUM ('active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_type AS ENUM ('lgu', 'suc', 'hei', 'government');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Users (extends auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  user_type public.user_type NOT NULL,
  organization TEXT,
  position TEXT,
  region TEXT NOT NULL DEFAULT 'Region 2',
  province TEXT,
  city TEXT,
  avatar TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  status public.user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Courses & content
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  level public.course_level NOT NULL DEFAULT 'beginner',
  duration INTEGER NOT NULL DEFAULT 0,
  target_audience TEXT[] NOT NULL DEFAULT '{}',
  prerequisites TEXT[],
  skills TEXT[],
  thumbnail TEXT,
  instructor TEXT NOT NULL DEFAULT '',
  rating NUMERIC(3, 2),
  enrollment_count INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL DEFAULT 1,
  estimated_duration INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type public.lesson_type NOT NULL DEFAULT 'pdf',
  "order" INTEGER NOT NULL DEFAULT 1,
  duration INTEGER NOT NULL DEFAULT 0,
  start_page INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  type public.resource_type NOT NULL DEFAULT 'pdf',
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.learningoutcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Learning paths
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.learningpaths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_audience TEXT[] NOT NULL DEFAULT '{}',
  status public.learning_path_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.learningpath_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id UUID NOT NULL REFERENCES public.learningpaths(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  course_order INTEGER NOT NULL DEFAULT 1,
  UNIQUE (learning_path_id, course_id)
);

-- ---------------------------------------------------------------------------
-- Enrollments & progress
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  grade NUMERIC(5, 2),
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  time_spent INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, course_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  verification_hash TEXT NOT NULL,
  status public.certificate_status NOT NULL DEFAULT 'active',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_course_active_idx
  ON public.certificates (user_id, course_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.organization_type NOT NULL,
  region TEXT NOT NULL DEFAULT 'Region 2',
  province TEXT,
  city TEXT,
  contact_email TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Admin audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_modules_course_id ON public.modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON public.lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_resources_module_id ON public.resources(module_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_course ON public.progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_verification ON public.certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_users_province ON public.users(province);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- RPC: atomic enrollment + progress seeding
-- ---------------------------------------------------------------------------

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
    COALESCE(enrollment_input->>'status', 'active')::public.enrollment_status,
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
-- Trigger: auto-create user profile on auth signup (optional helper)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Profile is created by the app on registration; this is a fallback no-op guard.
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Storage buckets (run in Supabase dashboard if INSERT fails)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('course-materials', 'course-materials', FALSE),
  ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO NOTHING;
