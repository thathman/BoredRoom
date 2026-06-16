DROP POLICY IF EXISTS "Anyone can record a match" ON public.matches;
CREATE POLICY "Anyone can record a valid match"
ON public.matches
FOR INSERT
WITH CHECK (
  length(btrim(room_code)) BETWEEN 3 AND 16
  AND array_length(player_device_ids, 1) BETWEEN 1 AND 8
  AND jsonb_typeof(player_names) = 'object'
  AND (game_type IN ('ludo', 'whot'))
);

DROP POLICY IF EXISTS "Anyone can create a profile" ON public.profiles;
CREATE POLICY "Anyone can create a valid profile"
ON public.profiles
FOR INSERT
WITH CHECK (
  length(btrim(device_id)) BETWEEN 8 AND 128
  AND length(btrim(username)) BETWEEN 1 AND 32
  AND length(btrim(avatar)) BETWEEN 1 AND 16
);

DROP POLICY IF EXISTS "Anyone can update profiles" ON public.profiles;
CREATE POLICY "Anyone can update a valid profile"
ON public.profiles
FOR UPDATE
USING (
  length(btrim(device_id)) BETWEEN 8 AND 128
)
WITH CHECK (
  length(btrim(device_id)) BETWEEN 8 AND 128
  AND length(btrim(username)) BETWEEN 1 AND 32
  AND length(btrim(avatar)) BETWEEN 1 AND 16
  AND games_played >= 0
  AND wins >= 0
);