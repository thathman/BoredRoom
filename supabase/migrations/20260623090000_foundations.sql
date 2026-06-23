-- Phase 1 Foundations: HouseSession spine.
-- HouseSession is the true persistence unit; GameRun is one play instance under it;
-- session_events is an append-only log; controller/operator devices persist across sessions.
-- See BoredRoom-Spec/06-data-models/05-zod-schemas.md.

-- House sessions -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.house_sessions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'setup',
  current_stage TEXT NOT NULL DEFAULT 'landing',
  selected_pack_ids TEXT[] NOT NULL DEFAULT '{}',
  active_pack_id TEXT,
  host_device_id TEXT NOT NULL,
  active_display_id TEXT,
  active_operator_ids TEXT[] NOT NULL DEFAULT '{}',
  current_game_run_id TEXT,
  walkthrough_completed BOOLEAN NOT NULL DEFAULT false,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.house_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "House sessions are viewable by everyone" ON public.house_sessions;
CREATE POLICY "House sessions are viewable by everyone"
  ON public.house_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create a house session" ON public.house_sessions;
CREATE POLICY "Anyone can create a house session"
  ON public.house_sessions FOR INSERT
  WITH CHECK (
    length(btrim(id)) BETWEEN 8 AND 128
    AND length(btrim(code)) BETWEEN 4 AND 16
    AND length(btrim(host_device_id)) BETWEEN 1 AND 128
  );

DROP POLICY IF EXISTS "Anyone can update a house session" ON public.house_sessions;
CREATE POLICY "Anyone can update a house session"
  ON public.house_sessions FOR UPDATE
  USING (length(btrim(id)) BETWEEN 8 AND 128)
  WITH CHECK (length(btrim(id)) BETWEEN 8 AND 128);

DROP TRIGGER IF EXISTS update_house_sessions_updated_at ON public.house_sessions;
CREATE TRIGGER update_house_sessions_updated_at
  BEFORE UPDATE ON public.house_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_house_sessions_host_device
  ON public.house_sessions(host_device_id, updated_at DESC);

-- Game runs ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_runs (
  id TEXT PRIMARY KEY,
  house_session_id TEXT NOT NULL REFERENCES public.house_sessions(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  room_code TEXT,
  status TEXT NOT NULL DEFAULT 'setup',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_player_ids TEXT[],
  recap_id TEXT,
  latest_snapshot_id TEXT
);

ALTER TABLE public.game_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Game runs are viewable by everyone" ON public.game_runs;
CREATE POLICY "Game runs are viewable by everyone"
  ON public.game_runs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create a game run" ON public.game_runs;
CREATE POLICY "Anyone can create a game run"
  ON public.game_runs FOR INSERT
  WITH CHECK (length(btrim(id)) BETWEEN 8 AND 128 AND length(btrim(house_session_id)) BETWEEN 8 AND 128);

DROP POLICY IF EXISTS "Anyone can update a game run" ON public.game_runs;
CREATE POLICY "Anyone can update a game run"
  ON public.game_runs FOR UPDATE
  USING (length(btrim(id)) BETWEEN 8 AND 128)
  WITH CHECK (length(btrim(id)) BETWEEN 8 AND 128);

CREATE INDEX IF NOT EXISTS idx_game_runs_session
  ON public.game_runs(house_session_id, started_at DESC);

-- Session events (append-only) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES public.house_sessions(id) ON DELETE CASCADE,
  game_run_id TEXT,
  type TEXT NOT NULL,
  actor_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Session events are viewable by everyone" ON public.session_events;
CREATE POLICY "Session events are viewable by everyone"
  ON public.session_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can append a session event" ON public.session_events;
CREATE POLICY "Anyone can append a session event"
  ON public.session_events FOR INSERT
  WITH CHECK (length(btrim(id)) BETWEEN 8 AND 128 AND length(btrim(session_id)) BETWEEN 8 AND 128);

CREATE INDEX IF NOT EXISTS idx_session_events_session
  ON public.session_events(session_id, at ASC);

-- Controller devices (persist across sessions) -----------------------------
CREATE TABLE IF NOT EXISTS public.controller_devices (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paired_session_ids TEXT[] NOT NULL DEFAULT '{}',
  player_profile_id TEXT
);

ALTER TABLE public.controller_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Controller devices are viewable by everyone" ON public.controller_devices;
CREATE POLICY "Controller devices are viewable by everyone"
  ON public.controller_devices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can upsert a controller device" ON public.controller_devices;
CREATE POLICY "Anyone can upsert a controller device"
  ON public.controller_devices FOR INSERT
  WITH CHECK (length(btrim(id)) BETWEEN 1 AND 128 AND length(btrim(display_name)) BETWEEN 1 AND 40);

DROP POLICY IF EXISTS "Anyone can update a controller device" ON public.controller_devices;
CREATE POLICY "Anyone can update a controller device"
  ON public.controller_devices FOR UPDATE
  USING (length(btrim(id)) BETWEEN 1 AND 128)
  WITH CHECK (length(btrim(id)) BETWEEN 1 AND 128);

-- Operator devices (session-scoped pairing) --------------------------------
CREATE TABLE IF NOT EXISTS public.operator_devices (
  id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES public.house_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'host',
  paired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, session_id)
);

ALTER TABLE public.operator_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operator devices are viewable by everyone" ON public.operator_devices;
CREATE POLICY "Operator devices are viewable by everyone"
  ON public.operator_devices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can pair an operator device" ON public.operator_devices;
CREATE POLICY "Anyone can pair an operator device"
  ON public.operator_devices FOR INSERT
  WITH CHECK (length(btrim(id)) BETWEEN 1 AND 128 AND length(btrim(session_id)) BETWEEN 8 AND 128);

DROP POLICY IF EXISTS "Anyone can update an operator device" ON public.operator_devices;
CREATE POLICY "Anyone can update an operator device"
  ON public.operator_devices FOR UPDATE
  USING (length(btrim(id)) BETWEEN 1 AND 128)
  WITH CHECK (length(btrim(id)) BETWEEN 1 AND 128);

CREATE INDEX IF NOT EXISTS idx_operator_devices_session
  ON public.operator_devices(session_id);
