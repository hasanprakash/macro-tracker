-- =============================================================================
-- Migration 025: Support Starting Weight & Seed Initial Weight Logs
-- Preserves user onboarding/starting weight for historical progress charts
-- =============================================================================

-- 1. Add starting_weight_kg column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS starting_weight_kg numeric;

-- 2. Backfill user who registered on 2026-08-27 with baseline weight 58.1
UPDATE public.profiles
SET starting_weight_kg = 58.1
WHERE id = '1f3bdc93-17a0-43cc-89d3-d7303cf00e29';

INSERT INTO public.weight_logs (user_id, weight, log_date, recorded_at)
SELECT 
  id,
  58.1,
  '2026-08-27'::date,
  '2026-08-27 10:12:35+00'::timestamptz
FROM public.profiles
WHERE id = '1f3bdc93-17a0-43cc-89d3-d7303cf00e29'
ON CONFLICT (user_id, log_date) DO UPDATE SET weight = EXCLUDED.weight;

-- 3. Set starting_weight_kg for any other profiles missing it
UPDATE public.profiles
SET starting_weight_kg = weight_kg
WHERE starting_weight_kg IS NULL AND weight_kg IS NOT NULL;

-- 4. Seed initial weight_logs for users who had weight in profile but no initial log on their creation date
INSERT INTO public.weight_logs (user_id, weight, log_date, recorded_at)
SELECT 
  p.id, 
  COALESCE(p.starting_weight_kg, p.weight_kg), 
  (p.created_at AT TIME ZONE 'UTC')::date, 
  p.created_at
FROM public.profiles p
WHERE p.weight_kg IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.weight_logs wl 
    WHERE wl.user_id = p.id AND wl.log_date = (p.created_at AT TIME ZONE 'UTC')::date
  )
ON CONFLICT (user_id, log_date) DO NOTHING;
