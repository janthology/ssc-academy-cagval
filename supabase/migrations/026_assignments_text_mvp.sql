-- 026_assignments_text_mvp.sql
-- P1-4b: Text-only assignments as lesson type=assignment.
-- Learner submits text; instructor grades; pass marks progress + grade rollup.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.assignment_prompts (
  lesson_id uuid PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
  instructions text NOT NULL DEFAULT '',
  pass_threshold numeric(5, 2) NOT NULL DEFAULT 70
    CHECK (pass_threshold >= 0 AND pass_threshold <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'graded', 'returned')),
  score_pct numeric(5, 2) CHECK (score_pct IS NULL OR (score_pct >= 0 AND score_pct <= 100)),
  feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  graded_at timestamptz,
  graded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_course_status
  ON public.assignment_submissions (course_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_lesson
  ON public.assignment_submissions (lesson_id, submitted_at DESC);

ALTER TABLE public.assignment_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 2. RLS
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.assignment_lesson_module_id(p_lesson_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT module_id FROM public.lessons WHERE id = p_lesson_id;
$$;

DROP POLICY IF EXISTS "assignment_prompts_select" ON public.assignment_prompts;
CREATE POLICY "assignment_prompts_select" ON public.assignment_prompts
  FOR SELECT USING (
    public.is_admin()
    OR public.owns_module(public.assignment_lesson_module_id(lesson_id))
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.enrollments e ON e.course_id = m.course_id AND e.user_id = auth.uid()
      WHERE l.id = assignment_prompts.lesson_id AND m.status = 'published'
    )
  );

DROP POLICY IF EXISTS "assignment_prompts_write" ON public.assignment_prompts;
CREATE POLICY "assignment_prompts_write" ON public.assignment_prompts
  FOR ALL USING (
    public.is_admin() OR public.owns_module(public.assignment_lesson_module_id(lesson_id))
  ) WITH CHECK (
    public.is_admin() OR public.owns_module(public.assignment_lesson_module_id(lesson_id))
  );

DROP POLICY IF EXISTS "assignment_submissions_select" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions_select" ON public.assignment_submissions
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignment_submissions.course_id AND c.instructor_id = auth.uid()
    )
  );

-- Learners insert/update only their own row while not graded (submitted/returned).
DROP POLICY IF EXISTS "assignment_submissions_learner_insert" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions_learner_insert" ON public.assignment_submissions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND status = 'submitted'
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = auth.uid() AND e.course_id = assignment_submissions.course_id
    )
  );

DROP POLICY IF EXISTS "assignment_submissions_learner_update" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions_learner_update" ON public.assignment_submissions
  FOR UPDATE USING (
    auth.uid() = user_id
    AND status IN ('submitted', 'returned')
  ) WITH CHECK (
    auth.uid() = user_id
    AND status = 'submitted'
  );

-- Instructor grades via RPC (SECURITY DEFINER); no direct client UPDATE for grades.
DROP POLICY IF EXISTS "assignment_submissions_instructor_update" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions_instructor_update" ON public.assignment_submissions
  FOR UPDATE USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignment_submissions.course_id AND c.instructor_id = auth.uid()
    )
  ) WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignment_submissions.course_id AND c.instructor_id = auth.uid()
    )
  );

-- ===========================================================================
-- 3. Grade rollup — quizzes + graded assignments
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.recalculate_course_grade(p_user_id uuid, p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg numeric;
BEGIN
  SELECT AVG(score_pct) INTO v_avg
  FROM (
    SELECT q.score_pct
    FROM (
      SELECT DISTINCT ON (a.lesson_id) a.score_pct
      FROM public.quiz_attempts a
      JOIN public.lessons l ON l.id = a.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      WHERE a.user_id = p_user_id
        AND a.course_id = p_course_id
        AND a.passed = true
        AND l.type = 'quiz'
        AND m.course_id = p_course_id
      ORDER BY a.lesson_id, a.score_pct DESC
    ) q

    UNION ALL

    SELECT s.score_pct
    FROM public.assignment_submissions s
    JOIN public.lessons l ON l.id = s.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    WHERE s.user_id = p_user_id
      AND s.course_id = p_course_id
      AND s.status = 'graded'
      AND s.score_pct IS NOT NULL
      AND l.type = 'assignment'
      AND m.course_id = p_course_id
  ) scores;

  UPDATE public.enrollments
  SET grade = CASE WHEN v_avg IS NULL THEN NULL ELSE ROUND(v_avg, 2) END
  WHERE user_id = p_user_id AND course_id = p_course_id;
END;
$$;

-- ===========================================================================
-- 4. submit_assignment — learner text submit / resubmit after returned
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.submit_assignment(p_lesson_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course uuid;
  v_module uuid;
  v_existing public.assignment_submissions%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Submission cannot be empty';
  END IF;

  SELECT l.module_id, m.course_id INTO v_module, v_course
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE l.id = p_lesson_id AND l.type = 'assignment' AND m.status = 'published';

  IF v_course IS NULL THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.user_id = v_uid AND e.course_id = v_course
  ) THEN
    RAISE EXCEPTION 'Not enrolled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assignment_prompts p WHERE p.lesson_id = p_lesson_id
  ) THEN
    RAISE EXCEPTION 'Assignment has no prompt yet';
  END IF;

  SELECT * INTO v_existing
  FROM public.assignment_submissions
  WHERE user_id = v_uid AND lesson_id = p_lesson_id;

  IF FOUND THEN
    IF v_existing.status = 'graded' THEN
      RAISE EXCEPTION 'Already graded; cannot resubmit';
    END IF;
    UPDATE public.assignment_submissions
    SET body = trim(p_body),
        status = 'submitted',
        score_pct = NULL,
        feedback = NULL,
        graded_at = NULL,
        graded_by = NULL,
        submitted_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.assignment_submissions (lesson_id, user_id, course_id, body, status)
    VALUES (p_lesson_id, v_uid, v_course, trim(p_body), 'submitted')
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'submission_id', v_id,
    'status', 'submitted'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_assignment(uuid, text) TO authenticated;

-- ===========================================================================
-- 5. grade_assignment — instructor sets score + feedback; pass → progress
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.grade_assignment(
  p_submission_id uuid,
  p_score_pct numeric,
  p_feedback text DEFAULT NULL,
  p_return boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.assignment_submissions%ROWTYPE;
  v_threshold numeric := 70;
  v_passed boolean;
  v_module uuid;
  v_new_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_score_pct IS NULL OR p_score_pct < 0 OR p_score_pct > 100 THEN
    RAISE EXCEPTION 'Score must be between 0 and 100';
  END IF;

  SELECT * INTO v_sub FROM public.assignment_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = v_sub.course_id AND c.instructor_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not allowed to grade this submission';
  END IF;

  SELECT COALESCE(p.pass_threshold, 70) INTO v_threshold
  FROM public.assignment_prompts p WHERE p.lesson_id = v_sub.lesson_id;
  IF v_threshold IS NULL THEN v_threshold := 70; END IF;

  v_passed := p_score_pct >= v_threshold;

  IF p_return AND NOT v_passed THEN
    v_new_status := 'returned';
  ELSE
    v_new_status := 'graded';
  END IF;

  UPDATE public.assignment_submissions
  SET score_pct = ROUND(p_score_pct, 2),
      feedback = NULLIF(trim(COALESCE(p_feedback, '')), ''),
      status = v_new_status,
      graded_at = now(),
      graded_by = v_uid
  WHERE id = p_submission_id;

  SELECT module_id INTO v_module FROM public.lessons WHERE id = v_sub.lesson_id;

  IF v_passed AND v_new_status = 'graded' THEN
    INSERT INTO public.progress (user_id, course_id, module_id, lesson_id, completed, completed_at)
    VALUES (v_sub.user_id, v_sub.course_id, v_module, v_sub.lesson_id, true, now())
    ON CONFLICT (user_id, course_id, lesson_id) DO UPDATE
      SET completed = true, completed_at = COALESCE(public.progress.completed_at, now());
  END IF;

  PERFORM public.recalculate_course_grade(v_sub.user_id, v_sub.course_id);

  RETURN jsonb_build_object(
    'submission_id', p_submission_id,
    'status', v_new_status,
    'score_pct', ROUND(p_score_pct, 2),
    'passed', v_passed,
    'pass_threshold', v_threshold
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_assignment(uuid, numeric, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_course_grade(uuid, uuid) TO authenticated;
