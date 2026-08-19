-- ===========================================================================
-- 016_events.sql
--
-- Platform-wide event announcements. Admin-created, readable by everyone
-- (including anon) — same public tier as the course catalog. Purely
-- informational: no RSVP, no attendees, no capacity.
--
-- Replaces the hardcoded fake array that shipped in dashboard-content.tsx
-- under a "[Placeholder: No event data available yet]" caption.
--
-- Conventions followed:
--  * text + CHECK, not an enum. Verified live: courses.level,
--    notifications.type and certificates.status are all text columns.
--  * gen_random_uuid() per the admin/system-write table lineage (see HANDOFF
--    "UUID default: two conventions by table lineage").
--  * Past events are NOT auto-hidden; readers filter starts_at >= now().
--    Nothing to clean up, no cron, and history stays queryable for the admin
--    list view.
--
-- APPLY IN 2 CHUNKS, IN ORDER.
-- ===========================================================================


-- ===========================================================================
-- CHUNK 1 of 2 — table + index
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  event_type   text NOT NULL DEFAULT 'live_session'
    CHECK (event_type IN ('live_session', 'hands_on', 'conference')),
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz,      -- optional; NULL = start time only
  location     text,             -- optional; venue OR join link
  is_published boolean NOT NULL DEFAULT TRUE,
  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_ends_after_starts CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON public.events (starts_at);


-- ===========================================================================
-- CHUNK 2 of 2 — RLS
--
-- Public tier, mirroring courses_public_read: announcements are not sensitive
-- and the dashboard widget must work for every logged-in role. Unpublished
-- (draft) rows stay admin-only. Writes are admin-only, exactly like
-- courses_admin_write.
-- ===========================================================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_public_read" ON public.events;
CREATE POLICY "events_public_read" ON public.events
  FOR SELECT USING (is_published = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "events_admin_write" ON public.events;
CREATE POLICY "events_admin_write" ON public.events
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
