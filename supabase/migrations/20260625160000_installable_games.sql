-- Independently installed, signed games. Historical game_runs retain game_type/version metadata
-- after an installation is removed.

CREATE TABLE IF NOT EXISTS public.installed_games (
  game_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  manifest JSONB NOT NULL,
  artifact_url TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'installed',
  error TEXT,
  update_override TEXT NOT NULL DEFAULT 'inherit',
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT installed_games_version_check CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'),
  CONSTRAINT installed_games_override_check CHECK (update_override IN ('inherit', 'enabled', 'disabled'))
);

ALTER TABLE public.installed_games ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.installed_games FROM anon, authenticated;
GRANT ALL ON public.installed_games TO service_role;

ALTER TABLE public.game_runs
  ADD COLUMN IF NOT EXISTS game_version TEXT;

-- Pack selection no longer participates in session or run authority. Columns remain nullable for
-- old recap compatibility, but all new code ignores them.
ALTER TABLE public.house_sessions
  ALTER COLUMN selected_pack_ids DROP NOT NULL,
  ALTER COLUMN selected_pack_ids DROP DEFAULT;
ALTER TABLE public.game_runs
  ALTER COLUMN pack_id DROP NOT NULL;
