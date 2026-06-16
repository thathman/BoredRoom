-- Replace the immutability trigger so finalization fields can be set ONCE
-- (when they were NULL / empty on insert), but never re-edited afterwards.
CREATE OR REPLACE FUNCTION public.replays_protect_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Always-immutable fields
  IF NEW.id != OLD.id
    OR NEW.share_token != OLD.share_token
    OR NEW.room_code != OLD.room_code
    OR NEW.game_type != OLD.game_type
    OR NEW.created_at != OLD.created_at
  THEN
    RAISE EXCEPTION 'replays: id/share_token/room_code/game_type/created_at are immutable';
  END IF;

  -- Finalization fields: writable only while they are still empty/NULL on OLD.
  IF OLD.winner_device_id IS NOT NULL AND coalesce(NEW.winner_device_id,'') != coalesce(OLD.winner_device_id,'') THEN
    RAISE EXCEPTION 'replays: winner_device_id already finalized';
  END IF;
  IF OLD.winner_name IS NOT NULL AND coalesce(NEW.winner_name,'') != coalesce(OLD.winner_name,'') THEN
    RAISE EXCEPTION 'replays: winner_name already finalized';
  END IF;
  IF OLD.recap IS NOT NULL AND NEW.recap::text != OLD.recap::text THEN
    RAISE EXCEPTION 'replays: recap already finalized';
  END IF;
  IF OLD.turn_count IS NOT NULL AND coalesce(NEW.turn_count,-1) != coalesce(OLD.turn_count,-1) THEN
    RAISE EXCEPTION 'replays: turn_count already finalized';
  END IF;
  IF OLD.duration_ms IS NOT NULL AND coalesce(NEW.duration_ms,-1) != coalesce(OLD.duration_ms,-1) THEN
    RAISE EXCEPTION 'replays: duration_ms already finalized';
  END IF;
  -- standings/final_state/player_names: writable only when OLD was empty placeholder.
  IF jsonb_array_length(coalesce(OLD.standings,'[]'::jsonb)) > 0
     AND NEW.standings::text != OLD.standings::text THEN
    RAISE EXCEPTION 'replays: standings already finalized';
  END IF;
  IF (OLD.final_state IS NOT NULL AND OLD.final_state::text != '{}'::text)
     AND NEW.final_state::text != OLD.final_state::text THEN
    RAISE EXCEPTION 'replays: final_state already finalized';
  END IF;
  IF (OLD.player_names IS NOT NULL AND OLD.player_names::text != '{}'::text)
     AND NEW.player_names::text != OLD.player_names::text THEN
    RAISE EXCEPTION 'replays: player_names already finalized';
  END IF;
  RETURN NEW;
END;
$function$;

-- Permit public UPDATE under the same shape constraints as INSERT.
DROP POLICY IF EXISTS "Anyone can finalize a replay" ON public.replays;
CREATE POLICY "Anyone can finalize a replay"
ON public.replays
FOR UPDATE
TO public
USING (true)
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