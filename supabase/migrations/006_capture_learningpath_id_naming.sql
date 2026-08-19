-- 006_capture_learningpath_id_naming.sql
-- Reconciles a live/migration drift: the live public.learningpath_courses table
-- has column `learningpath_id`, but 001_initial_schema.sql created it as
-- `learning_path_id`. The live column is authoritative and must NOT be renamed;
-- this migration instead makes a FRESH deploy (built from 001) match live by
-- renaming learning_path_id -> learningpath_id when that is the case.
--
-- Idempotent and safe on the live DB: it only renames when the old name exists
-- and the new one does not. On live (already learningpath_id) it is a no-op.
-- Dependent FK / unique constraints follow the column automatically on rename.

DO $$
BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'learningpath_courses'
          AND column_name = 'learning_path_id'
     )
     AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'learningpath_courses'
          AND column_name = 'learningpath_id'
     )
  THEN
    ALTER TABLE public.learningpath_courses RENAME COLUMN learning_path_id TO learningpath_id;
  END IF;
END $$;
