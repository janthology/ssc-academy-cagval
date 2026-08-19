-- ===========================================================================
-- 017_app_settings.sql
--
-- Smallest possible store for admin-controlled, platform-wide switches.
-- Introduced for one setting: whether the two built-in PLACEHOLDER learning
-- paths ("Technical Implementation Track", "Academic Research Track") are shown
-- to users. Those tracks are demo content — none of the ~18 courses they list
-- exist in the courses table (verified: 0 exact matches, and no close
-- equivalents even at a 0.15 similarity threshold).
--
-- Key/value rather than a single-purpose table: the next boolean switch costs
-- an INSERT instead of another migration. bool_value (not jsonb) keeps reads
-- cast-free; by design this table holds booleans only.
--
-- APPLY IN 2 CHUNKS, IN ORDER.
-- ===========================================================================


-- ===========================================================================
-- CHUNK 1 of 2 — table + the one setting
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  bool_value  boolean NOT NULL DEFAULT FALSE,
  description text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Seeded TRUE on purpose: applying this migration changes nothing a user sees.
-- Hiding the placeholders becomes an explicit admin decision, not a deploy
-- side effect.
INSERT INTO public.app_settings (key, bool_value, description)
VALUES (
  'show_placeholder_learning_paths',
  TRUE,
  'Show the two built-in placeholder learning paths (Technical Implementation Track, Academic Research Track). These have no real course content behind them.'
)
ON CONFLICT (key) DO NOTHING;


-- ===========================================================================
-- CHUNK 2 of 2 — RLS
--
-- Public read is load-bearing: this setting controls what the PUBLIC
-- /learning-paths page renders for anonymous visitors, not just what an admin
-- sees. An authenticated-only policy here would repeat the 015 organizations
-- mistake, where an anonymous surface silently read an empty table.
-- ===========================================================================
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_public_read" ON public.app_settings;
CREATE POLICY "app_settings_public_read" ON public.app_settings
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;
CREATE POLICY "app_settings_admin_write" ON public.app_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
