-- Development seed data (optional)
-- Run manually after migrations. Replace UUIDs/emails as needed.

-- Sample course
INSERT INTO public.courses (
  id,
  title,
  description,
  category,
  level,
  duration,
  target_audience,
  skills,
  thumbnail,
  instructor,
  rating,
  enrollment_count,
  is_active
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Introduction to Smart and Sustainable Communities',
  'Foundational course covering SSCP concepts for Region 2 stakeholders.',
  'Governance',
  'beginner',
  8,
  ARRAY['lgu', 'individual', 'suc', 'hei'],
  ARRAY['SSCP fundamentals', 'Smart city planning', 'Regional implementation'],
  '/placeholder.svg',
  'DOST Region 02',
  4.8,
  0,
  TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modules (
  id,
  course_id,
  title,
  description,
  "order",
  estimated_duration,
  is_required
) VALUES (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'Module 1: SSCP Overview',
  'Introduction to the Smart and Sustainable Communities Program.',
  1,
  60,
  TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (
  id,
  module_id,
  title,
  type,
  "order",
  duration,
  start_page
) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Lesson 1: Program Background', 'pdf', 1, 15, 1),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Lesson 2: Regional Context', 'pdf', 2, 15, 5),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Lesson 3: Stakeholder Roles', 'pdf', 3, 15, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.learningoutcomes (
  course_id,
  outcome,
  "order"
) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Explain the goals of the SSCP program', 1),
  ('a0000000-0000-4000-8000-000000000001', 'Identify key stakeholders in Region 2', 2),
  ('a0000000-0000-4000-8000-000000000001', 'Describe smart community implementation phases', 3)
ON CONFLICT DO NOTHING;

INSERT INTO public.learningpaths (
  id,
  title,
  description,
  target_audience,
  status
) VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'LGU Implementation Track',
  'Structured path for local government units implementing SSCP.',
  ARRAY['lgu'],
  'active'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.learningpath_courses (
  learning_path_id,
  course_id,
  course_order
) VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  1
) ON CONFLICT DO NOTHING;

-- Promote an existing user to admin (update email before running):
-- UPDATE public.users SET is_admin = TRUE WHERE email = 'admin@example.com';
