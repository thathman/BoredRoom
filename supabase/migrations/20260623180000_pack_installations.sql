-- Pack installations (server-wide). A pack is a content bundle pulled from a GitHub repo; installing
-- registers its games into the unified catalog. JSON only — no code is executed.

CREATE TABLE IF NOT EXISTS public.pack_installations (
  pack_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  source_url TEXT NOT NULL,
  manifest JSONB NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pack_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pack installations are viewable by everyone" ON public.pack_installations;
CREATE POLICY "Pack installations are viewable by everyone"
  ON public.pack_installations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can install a pack" ON public.pack_installations;
CREATE POLICY "Anyone can install a pack"
  ON public.pack_installations FOR INSERT
  WITH CHECK (length(btrim(pack_id)) BETWEEN 1 AND 128 AND length(btrim(source_url)) BETWEEN 1 AND 512);

DROP POLICY IF EXISTS "Anyone can update a pack installation" ON public.pack_installations;
CREATE POLICY "Anyone can update a pack installation"
  ON public.pack_installations FOR UPDATE
  USING (length(btrim(pack_id)) BETWEEN 1 AND 128)
  WITH CHECK (length(btrim(pack_id)) BETWEEN 1 AND 128);

DROP POLICY IF EXISTS "Anyone can uninstall a pack" ON public.pack_installations;
CREATE POLICY "Anyone can uninstall a pack"
  ON public.pack_installations FOR DELETE
  USING (length(btrim(pack_id)) BETWEEN 1 AND 128);

GRANT ALL ON public.pack_installations TO anon, authenticated, service_role;
