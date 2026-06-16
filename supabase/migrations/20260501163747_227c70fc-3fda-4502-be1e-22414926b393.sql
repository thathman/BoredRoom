REVOKE EXECUTE ON FUNCTION public.bump_replay_view_count(TEXT) FROM anon, authenticated, public;
DROP FUNCTION IF EXISTS public.bump_replay_view_count(TEXT);

-- view_count column stays for future internal analytics jobs (server-side
-- service role can still update it).
