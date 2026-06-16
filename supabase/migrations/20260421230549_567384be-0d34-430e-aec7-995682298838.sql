-- Profiles table keyed by device id (stored client-side in localStorage)
CREATE TABLE public.profiles (
  device_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🎮',
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Public read for display purposes
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Anyone can create their own profile (identified by device id)
CREATE POLICY "Anyone can create a profile"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- Anyone can update profiles (device id is the auth signal here)
CREATE POLICY "Anyone can update profiles"
  ON public.profiles FOR UPDATE
  USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Matches table for game history
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'ludo',
  winner_device_id TEXT,
  player_device_ids TEXT[] NOT NULL DEFAULT '{}',
  player_names JSONB NOT NULL DEFAULT '{}'::jsonb,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches are viewable by everyone"
  ON public.matches FOR SELECT
  USING (true);

CREATE POLICY "Anyone can record a match"
  ON public.matches FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_matches_winner ON public.matches(winner_device_id);
CREATE INDEX idx_matches_finished_at ON public.matches(finished_at DESC);