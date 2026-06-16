DROP POLICY IF EXISTS "Anyone can bump view count" ON public.replays;

CREATE POLICY "Anyone can bump view count by one"
  ON public.replays FOR UPDATE TO public
  USING (true)
  WITH CHECK (view_count = view_count);

-- The above check is still trivially true at row-level; replace with a check
-- that the new view_count is not less than the old one. This requires using
-- the trigger we already have to enforce the +1 rule, while keeping RLS
-- non-trivially permissive at the policy layer.
DROP POLICY IF EXISTS "Anyone can bump view count by one" ON public.replays;

-- Move enforcement into the trigger entirely; remove the UPDATE policy.
-- view_count bumps now require a SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.bump_replay_view_count(p_share_token TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.replays
  SET view_count = view_count + 1
  WHERE share_token = p_share_token
  RETURNING view_count INTO new_count;
  RETURN coalesce(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_replay_view_count(TEXT) TO anon, authenticated;
