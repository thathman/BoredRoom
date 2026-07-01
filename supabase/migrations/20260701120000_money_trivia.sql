-- Money Trivia: durable cash results and the server-only reviewed question bank.
-- BoredRoom only records host-funded payouts; it never collects or transfers money.

-- 1. Safe cash result on each game run (contestant, pledged/earned, outcome, currency, settlement).
ALTER TABLE public.game_runs
  ADD COLUMN IF NOT EXISTS result JSONB;

-- 2. Server-only reviewed question bank. Content, provenance, review status, expiry and audit
--    timestamps. Never exposed to clients; only approved, non-expired rows enter a cash run.
CREATE TABLE IF NOT EXISTS public.money_trivia_questions (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL DEFAULT 'hot_seat' CHECK (kind IN ('hot_seat', 'fastest_finger')),
  prompt        TEXT NOT NULL,
  options       JSONB NOT NULL,
  answer        INTEGER NOT NULL DEFAULT 0,
  correct_order JSONB,                       -- fastest-finger only
  category      TEXT NOT NULL,
  age_band      TEXT NOT NULL CHECK (age_band IN ('pre_teen', 'teen', 'adult')),
  difficulty    INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 15),
  explanation   TEXT NOT NULL DEFAULT '',
  source_url    TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('approved', 'draft', 'rejected', 'retired')),
  review_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry        DATE,
  provenance    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. { "generatedBy": "ai", "model": "…" }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS money_trivia_questions_selection_idx
  ON public.money_trivia_questions (age_band, review_status, difficulty);

-- Server-only: service role writes/reads; deny all client access via RLS with no permissive policy.
ALTER TABLE public.money_trivia_questions ENABLE ROW LEVEL SECURITY;
