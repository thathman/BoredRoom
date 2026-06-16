ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS match_key TEXT,
  ADD COLUMN IF NOT EXISTS turn_count INTEGER,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS matches_match_key_unique
  ON public.matches (match_key)
  WHERE match_key IS NOT NULL;