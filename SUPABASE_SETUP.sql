-- Mystery Box: Supabase wiring script
-- Run this in Supabase SQL Editor after a reset.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Align rounds status with app code (app uses: waiting | active | paused | ended)
ALTER TABLE public.rounds
  DROP CONSTRAINT IF EXISTS rounds_status_check;

ALTER TABLE public.rounds
  ADD CONSTRAINT rounds_status_check
  CHECK (status = ANY (ARRAY['waiting'::text, 'active'::text, 'paused'::text, 'ended'::text]));

ALTER TABLE public.rounds
  ALTER COLUMN status SET DEFAULT 'waiting'::text;

UPDATE public.rounds
SET status = 'waiting'
WHERE status = 'pending';

-- 2) Safety uniqueness used by API behavior
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_unique_idx
  ON public.teams (LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS teams_code_unique_idx
  ON public.teams (UPPER(code));

CREATE UNIQUE INDEX IF NOT EXISTS team_rounds_team_round_unique_idx
  ON public.team_rounds (team_id, round_id);

CREATE UNIQUE INDEX IF NOT EXISTS players_user_unique_idx
  ON public.players (user_id)
  WHERE user_id IS NOT NULL;

-- 3) Performance indexes for hot API paths
CREATE INDEX IF NOT EXISTS rounds_round_number_idx
  ON public.rounds (round_number);

CREATE INDEX IF NOT EXISTS teams_active_score_idx
  ON public.teams (is_active, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS players_team_idx
  ON public.players (team_id);

CREATE INDEX IF NOT EXISTS mystery_boxes_round_lock_idx
  ON public.mystery_boxes (round_number, is_locked);

CREATE INDEX IF NOT EXISTS box_opens_team_round_status_opened_idx
  ON public.box_opens (team_id, round_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS box_opens_round_idx
  ON public.box_opens (round_id);

CREATE INDEX IF NOT EXISTS team_rounds_team_status_started_idx
  ON public.team_rounds (team_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS team_events_team_created_idx
  ON public.team_events (team_id, created_at DESC);

-- 4) Seed/repair Round 1 baseline so Admin page can start cleanly
INSERT INTO public.rounds (
  round_number,
  title,
  status,
  duration_seconds,
  elapsed_seconds,
  started_at,
  paused_at,
  ended_at,
  ended_by
)
VALUES (
  1,
  'Round 1',
  'waiting',
  180,
  0,
  NULL,
  NULL,
  NULL,
  NULL
)
ON CONFLICT (round_number)
DO UPDATE SET
  title = EXCLUDED.title,
  duration_seconds = EXCLUDED.duration_seconds;

-- Optional but recommended reset for Round 1 state after DB wipe/rebuild
UPDATE public.rounds
SET
  status = 'waiting',
  elapsed_seconds = 0,
  started_at = NULL,
  paused_at = NULL,
  ended_at = NULL,
  ended_by = NULL
WHERE round_number = 1;

DELETE FROM public.team_rounds
WHERE round_id = (SELECT id FROM public.rounds WHERE round_number = 1);

DELETE FROM public.box_opens
WHERE round_id = (SELECT id FROM public.rounds WHERE round_number = 1);

-- 5) Seed sample games only when table is empty (so app can open mystery box immediately)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mystery_boxes) THEN
    INSERT INTO public.mystery_boxes (
      round_number,
      box_number,
      game_title,
      game_description,
      game_type,
      points_value,
      is_locked,
      assigned_by_admin
    ) VALUES
      (1, 1, 'Math Sprint', 'Solve the quick math challenge.', 'task', 100, false, false),
      (1, 2, 'Logic Grid', 'Crack the logic puzzle.', 'trivia', 100, false, false),
      (1, 3, 'Creative Pitch', 'Deliver a 30-second creative solution.', 'creative', 120, false, false),
      (1, 4, 'Rapid Recall', 'Answer fast recall questions.', 'trivia', 100, false, false),
      (1, 5, 'Build It', 'Complete a small physical build task.', 'physical', 150, false, false),
      (1, 6, 'Code Decode', 'Decode the hidden pattern.', 'task', 120, false, false);
  END IF;
END $$;

COMMIT;

-- Quick sanity checks:
-- SELECT round_number, status, duration_seconds FROM public.rounds ORDER BY round_number;
-- SELECT count(*) AS games_count FROM public.mystery_boxes WHERE round_number = 1;
-- SELECT count(*) AS teams_count FROM public.teams;
