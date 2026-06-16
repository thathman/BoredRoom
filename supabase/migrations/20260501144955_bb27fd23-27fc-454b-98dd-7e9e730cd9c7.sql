DROP POLICY IF EXISTS "Anyone can record a valid match" ON public.matches;

CREATE POLICY "Anyone can record a valid match"
ON public.matches
FOR INSERT
TO public
WITH CHECK (
  length(btrim(room_code)) >= 3
  AND length(btrim(room_code)) <= 16
  AND array_length(player_device_ids, 1) >= 1
  AND array_length(player_device_ids, 1) <= 8
  AND jsonb_typeof(player_names) = 'object'
  AND game_type = ANY (ARRAY[
    'ludo','whot','trivia','connect-4','ettt','logo',
    'landlord','color-wahala','hustle','word-wahala','half-half'
  ])
);