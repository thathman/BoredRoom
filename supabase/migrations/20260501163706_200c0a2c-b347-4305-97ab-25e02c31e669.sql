-- Replays table: stores a final-state snapshot of a finished match, plus
-- optional turn snapshots (future). Public read, controlled write.
--
-- Snapshot is the JSON-serialised public room state at game finish, plus
-- standings + recap. The 'share_token' is a short opaque ID used as the
-- public URL (/r/:share_token), independent of the room code (which gets
-- recycled).

CREATE TABLE public.replays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token TEXT NOT NULL UNIQUE,
  room_code TEXT NOT NULL,
  game_type TEXT NOT NULL,
  winner_device_id TEXT,
  winner_name TEXT,
  player_names JSONB NOT NULL DEFAULT '{}'::jsonb,
  standings JSONB NOT NULL DEFAULT '[]'::jsonb,
  recap JSONB,
  final_state JSONB NOT NULL,
  turn_count INTEGER,
  duration_ms INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_replays_share_token ON public.replays(share_token);
CREATE INDEX idx_replays_created_at ON public.replays(created_at DESC);

-- Optional per-turn snapshots for timeline scrubbing.
-- Rooms can opt-in by inserting one row per turn during play. Replays still
-- work without these (final state only, no scrubber).
CREATE TABLE public.replay_turns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  replay_id UUID NOT NULL REFERENCES public.replays(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(replay_id, turn_number)
);

CREATE INDEX idx_replay_turns_replay ON public.replay_turns(replay_id, turn_number);

ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_turns ENABLE ROW LEVEL SECURITY;

-- Public can read everything (replays are intentionally shareable).
CREATE POLICY "Replays are viewable by everyone"
  ON public.replays FOR SELECT TO public
  USING (true);

CREATE POLICY "Replay turns are viewable by everyone"
  ON public.replay_turns FOR SELECT TO public
  USING (true);

-- Insert: anyone can submit a finished-match replay, with strict shape checks
-- mirroring the matches policy.
CREATE POLICY "Anyone can record a replay"
  ON public.replays FOR INSERT TO public
  WITH CHECK (
    length(btrim(share_token)) >= 6
    AND length(btrim(share_token)) <= 32
    AND length(btrim(room_code)) >= 3
    AND length(btrim(room_code)) <= 16
    AND game_type = ANY (ARRAY['ludo','whot','trivia','connect-4','ettt','logo','landlord','color-wahala','hustle','word-wahala','half-half'])
    AND jsonb_typeof(player_names) = 'object'
    AND jsonb_typeof(standings) = 'array'
    AND jsonb_typeof(final_state) = 'object'
  );

CREATE POLICY "Anyone can record a replay turn"
  ON public.replay_turns FOR INSERT TO public
  WITH CHECK (
    turn_number >= 0
    AND turn_number <= 10000
    AND jsonb_typeof(snapshot) = 'object'
  );

-- Allow updating only view_count (for analytics on share opens).
CREATE POLICY "Anyone can bump view count"
  ON public.replays FOR UPDATE TO public
  USING (true)
  WITH CHECK (
    -- only the view_count column is allowed to change; check by ensuring
    -- the rest stay equal. Postgres validates row before/after via trigger
    -- below.
    true
  );

-- Trigger to enforce view_count is the only mutable column.
CREATE OR REPLACE FUNCTION public.replays_protect_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id != OLD.id
    OR NEW.share_token != OLD.share_token
    OR NEW.room_code != OLD.room_code
    OR NEW.game_type != OLD.game_type
    OR coalesce(NEW.winner_device_id,'') != coalesce(OLD.winner_device_id,'')
    OR coalesce(NEW.winner_name,'') != coalesce(OLD.winner_name,'')
    OR NEW.player_names::text != OLD.player_names::text
    OR NEW.standings::text != OLD.standings::text
    OR coalesce(NEW.recap::text,'') != coalesce(OLD.recap::text,'')
    OR NEW.final_state::text != OLD.final_state::text
    OR coalesce(NEW.turn_count,-1) != coalesce(OLD.turn_count,-1)
    OR coalesce(NEW.duration_ms,-1) != coalesce(OLD.duration_ms,-1)
    OR NEW.created_at != OLD.created_at
  THEN
    RAISE EXCEPTION 'replays: only view_count is mutable post-insert';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER replays_protect_immutable_columns_trg
  BEFORE UPDATE ON public.replays
  FOR EACH ROW
  EXECUTE FUNCTION public.replays_protect_immutable_columns();
