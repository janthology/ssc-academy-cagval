-- 012_enforce_prerequisites_in_enroll_rpc.sql
-- Close the RPC-bypass gap found in prerequisite check 3.1: enroll_and_track_progress
-- (002) checked only auth/user_id, so a direct RPC call bypassing the UI could
-- insert an enrollment for a course whose prerequisites the user has not met. The
-- module-URL server gate already blocks CONTENT access in that case, but the
-- enrollment row itself should not be creatable.
--
-- This adds one guard at the top of the function: call get_unmet_prerequisites()
-- (the same single source of truth used everywhere else) for the target course and
-- RAISE if any prerequisite is unmet. get_unmet_prerequisites uses auth.uid()
-- internally; auth.uid() reflects the CALLER even inside SECURITY DEFINER, and the
-- function already requires enrollment_input.user_id = auth.uid(), so the checked
-- course and user are the caller's own. cardinality() is 0 for an empty array
-- (eligible -> proceed), > 0 when prerequisites remain (blocked -> raise).
--
-- The rest of the function body is unchanged from 002.

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

  -- Prerequisite gate (single source of truth). Blocks enrollment at the RPC
  -- layer, not just in the UI, so a direct call cannot bypass it.
  IF cardinality(
       public.get_unmet_prerequisites((enrollment_input->>'course_id')::UUID)
     ) > 0 THEN
    RAISE EXCEPTION 'Cannot enroll: unmet prerequisites for this course';
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

GRANT EXECUTE ON FUNCTION public.enroll_and_track_progress(JSONB, JSONB) TO authenticated;
