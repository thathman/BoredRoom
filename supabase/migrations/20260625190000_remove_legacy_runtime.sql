-- BoredRoom 1.3.0.0: one HouseSessionRoom, version-pinned installed games, no packs/operators.

UPDATE public.game_runs
SET game_version = COALESCE(game_version, '1.0.0.0')
WHERE game_version IS NULL;

ALTER TABLE public.game_runs
  ALTER COLUMN game_version SET NOT NULL,
  DROP COLUMN IF EXISTS pack_id,
  DROP COLUMN IF EXISTS room_code;

ALTER TABLE public.house_sessions
  DROP COLUMN IF EXISTS selected_pack_ids,
  DROP COLUMN IF EXISTS active_pack_id,
  DROP COLUMN IF EXISTS active_operator_ids;

DROP TABLE IF EXISTS public.operator_devices;
DROP TABLE IF EXISTS public.pack_installations;

CREATE TABLE IF NOT EXISTS public.session_members (
  session_id TEXT NOT NULL REFERENCES public.house_sessions(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  ready BOOLEAN NOT NULL DEFAULT false,
  connected BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.game_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_run_id TEXT NOT NULL REFERENCES public.game_runs(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_members_session ON public.session_members(session_id);
CREATE INDEX IF NOT EXISTS idx_game_snapshots_run ON public.game_snapshots(game_run_id, created_at DESC);

ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_members FROM anon, authenticated;
REVOKE ALL ON public.game_snapshots FROM anon, authenticated;
GRANT ALL ON public.session_members TO service_role;
GRANT ALL ON public.game_snapshots TO service_role;
