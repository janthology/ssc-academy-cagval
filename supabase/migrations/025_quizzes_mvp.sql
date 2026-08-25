-- 025_quizzes_mvp.sql
-- P1-4a: MCQ quizzes as lesson type=quiz, scored via SECURITY DEFINER RPC.
-- Pass marks progress.completed; best scores roll into enrollments.grade.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.quiz_settings (
  lesson_id uuid PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
  pass_threshold numeric(5, 2) NOT NULL DEFAULT 70
    CHECK (pass_threshold >= 0 AND pass_threshold <= 100)
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  "order" integer NOT NULL DEFAULT 1,
  points numeric(5, 2) NOT NULL DEFAULT 1 CHECK (points > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  "order" integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  score_pct numeric(5, 2) NOT NULL CHECK (score_pct >= 0 AND score_pct <= 100),
  passed boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  selected_option_id uuid REFERENCES public.quiz_options(id) ON DELETE SET NULL,
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson ON public.quiz_questions (lesson_id, "order");
CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON public.quiz_options (question_id, "order");
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson ON public.quiz_attempts (user_id, lesson_id, submitted_at DESC);

ALTER TABLE public.quiz_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 2. RLS — instructors own modules; learners read own attempts; no client is_correct leak via RPC
-- ===========================================================================
-- Settings / questions / options: instructor+admin write; enrolled+owner read questions/options
-- (options include is_correct for instructors; learners should use get_quiz_for_take)

CREATE OR REPLACE FUNCTION public.quiz_lesson_module_id(p_lesson_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT module_id FROM public.lessons WHERE id = p_lesson_id;
$$;

DROP POLICY IF EXISTS "quiz_settings_select" ON public.quiz_settings;
CREATE POLICY "quiz_settings_select" ON public.quiz_settings
  FOR SELECT USING (
    public.is_admin()
    OR public.owns_module(public.quiz_lesson_module_id(lesson_id))
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.enrollments e ON e.course_id = m.course_id AND e.user_id = auth.uid()
      WHERE l.id = quiz_settings.lesson_id AND m.status = 'published'
    )
  );

DROP POLICY IF EXISTS "quiz_settings_write" ON public.quiz_settings;
CREATE POLICY "quiz_settings_write" ON public.quiz_settings
  FOR ALL USING (
    public.is_admin() OR public.owns_module(public.quiz_lesson_module_id(lesson_id))
  ) WITH CHECK (
    public.is_admin() OR public.owns_module(public.quiz_lesson_module_id(lesson_id))
  );

DROP POLICY IF EXISTS "quiz_questions_select" ON public.quiz_questions;
CREATE POLICY "quiz_questions_select" ON public.quiz_questions
  FOR SELECT USING (
    public.is_admin()
    OR public.owns_module(public.quiz_lesson_module_id(lesson_id))
  );

DROP POLICY IF EXISTS "quiz_questions_write" ON public.quiz_questions;
CREATE POLICY "quiz_questions_write" ON public.quiz_questions
  FOR ALL USING (
    public.is_admin() OR public.owns_module(public.quiz_lesson_module_id(lesson_id))
  ) WITH CHECK (
    public.is_admin() OR public.owns_module(public.quiz_lesson_module_id(lesson_id))
  );

DROP POLICY IF EXISTS "quiz_options_select" ON public.quiz_options;
CREATE POLICY "quiz_options_select" ON public.quiz_options
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.quiz_questions q
      WHERE q.id = quiz_options.question_id
        AND public.owns_module(public.quiz_lesson_module_id(q.lesson_id))
    )
  );

DROP POLICY IF EXISTS "quiz_options_write" ON public.quiz_options;
CREATE POLICY "quiz_options_write" ON public.quiz_options
  FOR ALL USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.quiz_questions q
      WHERE q.id = quiz_options.question_id
        AND public.owns_module(public.quiz_lesson_module_id(q.lesson_id))
    )
  ) WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.quiz_questions q
      WHERE q.id = quiz_options.question_id
        AND public.owns_module(public.quiz_lesson_module_id(q.lesson_id))
    )
  );

DROP POLICY IF EXISTS "quiz_attempts_select_own" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_select_own" ON public.quiz_attempts
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = quiz_attempts.course_id AND c.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "quiz_attempts_no_client_insert" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_no_client_insert" ON public.quiz_attempts
  FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "quiz_answers_select_own" ON public.quiz_answers;
CREATE POLICY "quiz_answers_select_own" ON public.quiz_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts a
      WHERE a.id = quiz_answers.attempt_id
        AND (a.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "quiz_answers_no_client_insert" ON public.quiz_answers;
CREATE POLICY "quiz_answers_no_client_insert" ON public.quiz_answers
  FOR INSERT WITH CHECK (FALSE);

-- ===========================================================================
-- 3. get_quiz_for_take — questions + options WITHOUT is_correct
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_quiz_for_take(p_lesson_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course uuid;
  v_threshold numeric;
  result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.course_id INTO v_course
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE l.id = p_lesson_id AND l.type = 'quiz'
    AND (
      m.status = 'published'
      OR public.is_admin()
      OR public.owns_module(m.id)
    );

  IF v_course IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.user_id = v_uid AND e.course_id = v_course
  ) AND NOT public.is_admin() AND NOT public.owns_module(
    (SELECT module_id FROM public.lessons WHERE id = p_lesson_id)
  ) THEN
    RAISE EXCEPTION 'Not enrolled';
  END IF;

  SELECT COALESCE(s.pass_threshold, 70) INTO v_threshold
  FROM public.quiz_settings s WHERE s.lesson_id = p_lesson_id;
  IF v_threshold IS NULL THEN v_threshold := 70; END IF;

  SELECT jsonb_build_object(
    'lesson_id', p_lesson_id,
    'pass_threshold', v_threshold,
    'questions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'prompt', q.prompt,
          'order', q."order",
          'points', q.points,
          'options', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object('id', o.id, 'label', o.label, 'order', o."order")
              ORDER BY o."order"
            ), '[]'::jsonb)
            FROM public.quiz_options o WHERE o.question_id = q.id
          )
        )
        ORDER BY q."order"
      )
      FROM public.quiz_questions q WHERE q.lesson_id = p_lesson_id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quiz_for_take(uuid) TO authenticated;

-- ===========================================================================
-- 4. submit_quiz_attempt — score, record, mark progress, update grade
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
  SELECT AVG(best.score_pct) INTO v_avg
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
  ) best;

  UPDATE public.enrollments
  SET grade = ROUND(v_avg, 2)
  WHERE user_id = p_user_id AND course_id = p_course_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(p_lesson_id uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course uuid;
  v_module uuid;
  v_threshold numeric := 70;
  v_total numeric := 0;
  v_earned numeric := 0;
  v_score numeric;
  v_passed boolean;
  v_attempt_id uuid;
  q record;
  v_selected uuid;
  v_correct uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT l.module_id, m.course_id INTO v_module, v_course
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE l.id = p_lesson_id AND l.type = 'quiz' AND m.status = 'published';

  IF v_course IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.user_id = v_uid AND e.course_id = v_course
  ) THEN
    RAISE EXCEPTION 'Not enrolled';
  END IF;

  SELECT COALESCE(s.pass_threshold, 70) INTO v_threshold
  FROM public.quiz_settings s WHERE s.lesson_id = p_lesson_id;
  IF v_threshold IS NULL THEN v_threshold := 70; END IF;

  FOR q IN
    SELECT id, points FROM public.quiz_questions WHERE lesson_id = p_lesson_id ORDER BY "order"
  LOOP
    v_total := v_total + q.points;
    v_selected := NULL;
    BEGIN
      v_selected := (p_answers ->> q.id::text)::uuid;
    EXCEPTION WHEN others THEN
      v_selected := NULL;
    END;

    SELECT o.id INTO v_correct
    FROM public.quiz_options o
    WHERE o.question_id = q.id AND o.is_correct = true
    ORDER BY o."order"
    LIMIT 1;

    IF v_selected IS NOT NULL AND v_correct IS NOT NULL AND v_selected = v_correct THEN
      v_earned := v_earned + q.points;
    END IF;
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Quiz has no questions';
  END IF;

  v_score := ROUND((v_earned / v_total) * 100, 2);
  v_passed := v_score >= v_threshold;

  INSERT INTO public.quiz_attempts (user_id, lesson_id, course_id, score_pct, passed)
  VALUES (v_uid, p_lesson_id, v_course, v_score, v_passed)
  RETURNING id INTO v_attempt_id;

  FOR q IN SELECT id FROM public.quiz_questions WHERE lesson_id = p_lesson_id
  LOOP
    v_selected := NULL;
    BEGIN
      v_selected := (p_answers ->> q.id::text)::uuid;
    EXCEPTION WHEN others THEN
      v_selected := NULL;
    END;
    INSERT INTO public.quiz_answers (attempt_id, question_id, selected_option_id)
    VALUES (v_attempt_id, q.id, v_selected);
  END LOOP;

  IF v_passed THEN
    INSERT INTO public.progress (user_id, course_id, module_id, lesson_id, completed, completed_at)
    VALUES (v_uid, v_course, v_module, p_lesson_id, true, now())
    ON CONFLICT (user_id, course_id, lesson_id) DO UPDATE
      SET completed = true, completed_at = COALESCE(public.progress.completed_at, now());
  END IF;

  PERFORM public.recalculate_course_grade(v_uid, v_course);

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'score_pct', v_score,
    'passed', v_passed,
    'pass_threshold', v_threshold
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_course_grade(uuid, uuid) TO authenticated;
