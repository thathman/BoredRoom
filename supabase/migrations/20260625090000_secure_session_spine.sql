-- Unified session replacement: only the trusted server may mutate session-spine tables.

ALTER TABLE public.house_sessions
  ADD COLUMN IF NOT EXISTS owner_credential_hash TEXT,
  ADD COLUMN IF NOT EXISTS companion_credential_hashes TEXT[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS "Anyone can create a house session" ON public.house_sessions;
DROP POLICY IF EXISTS "Anyone can update a house session" ON public.house_sessions;
DROP POLICY IF EXISTS "Anyone can create a game run" ON public.game_runs;
DROP POLICY IF EXISTS "Anyone can update a game run" ON public.game_runs;
DROP POLICY IF EXISTS "Anyone can append a session event" ON public.session_events;
DROP POLICY IF EXISTS "Anyone can upsert a controller device" ON public.controller_devices;
DROP POLICY IF EXISTS "Anyone can update a controller device" ON public.controller_devices;
DROP POLICY IF EXISTS "Anyone can pair an operator device" ON public.operator_devices;
DROP POLICY IF EXISTS "Anyone can update an operator device" ON public.operator_devices;
DROP POLICY IF EXISTS "Anyone can install a pack" ON public.pack_installations;
DROP POLICY IF EXISTS "Anyone can update a pack installation" ON public.pack_installations;
DROP POLICY IF EXISTS "Anyone can uninstall a pack" ON public.pack_installations;
DROP POLICY IF EXISTS "House sessions are viewable by everyone" ON public.house_sessions;
DROP POLICY IF EXISTS "Game runs are viewable by everyone" ON public.game_runs;
DROP POLICY IF EXISTS "Session events are viewable by everyone" ON public.session_events;
DROP POLICY IF EXISTS "Controller devices are viewable by everyone" ON public.controller_devices;
DROP POLICY IF EXISTS "Operator devices are viewable by everyone" ON public.operator_devices;
DROP POLICY IF EXISTS "Pack installations are viewable by everyone" ON public.pack_installations;

REVOKE ALL ON public.house_sessions FROM anon, authenticated;
REVOKE ALL ON public.game_runs FROM anon, authenticated;
REVOKE ALL ON public.session_events FROM anon, authenticated;
REVOKE ALL ON public.controller_devices FROM anon, authenticated;
REVOKE ALL ON public.operator_devices FROM anon, authenticated;
REVOKE ALL ON public.pack_installations FROM anon, authenticated;

GRANT ALL ON public.house_sessions TO service_role;
GRANT ALL ON public.game_runs TO service_role;
GRANT ALL ON public.session_events TO service_role;
GRANT ALL ON public.controller_devices TO service_role;
GRANT ALL ON public.operator_devices TO service_role;
GRANT ALL ON public.pack_installations TO service_role;
