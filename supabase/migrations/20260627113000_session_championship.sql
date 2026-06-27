-- Cross-game house championship standings. Raw scores differ by game, so the
-- session compares game wins and keeps participation counts for transparent ties.
ALTER TABLE public.house_sessions
  ADD COLUMN IF NOT EXISTS standings JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_game_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.house_sessions
  DROP CONSTRAINT IF EXISTS house_sessions_completed_game_count_nonnegative;

ALTER TABLE public.house_sessions
  ADD CONSTRAINT house_sessions_completed_game_count_nonnegative
  CHECK (completed_game_count >= 0);
