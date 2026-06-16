CREATE TABLE IF NOT EXISTS public.display_parties (
  id TEXT PRIMARY KEY,
  host_display_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Home table',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.display_parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Display parties are viewable by everyone" ON public.display_parties;
CREATE POLICY "Display parties are viewable by everyone"
  ON public.display_parties FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can create a display party" ON public.display_parties;
CREATE POLICY "Anyone can create a display party"
  ON public.display_parties FOR INSERT
  WITH CHECK (
    length(btrim(id)) BETWEEN 8 AND 128
    AND length(btrim(host_display_id)) BETWEEN 8 AND 128
    AND length(btrim(name)) BETWEEN 1 AND 40
  );

DROP POLICY IF EXISTS "Anyone can update a display party" ON public.display_parties;
CREATE POLICY "Anyone can update a display party"
  ON public.display_parties FOR UPDATE
  USING (length(btrim(id)) BETWEEN 8 AND 128)
  WITH CHECK (
    length(btrim(id)) BETWEEN 8 AND 128
    AND length(btrim(host_display_id)) BETWEEN 8 AND 128
    AND length(btrim(name)) BETWEEN 1 AND 40
  );

DROP TRIGGER IF EXISTS update_display_parties_updated_at ON public.display_parties;
CREATE TRIGGER update_display_parties_updated_at
  BEFORE UPDATE ON public.display_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS host_display_id TEXT,
  ADD COLUMN IF NOT EXISTS party_id TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_host_display_id
  ON public.matches(host_display_id, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_party_id
  ON public.matches(party_id, finished_at DESC);
