-- =============================================================================
-- Migration 004: User Targets & Onboarding Metrics
-- =============================================================================

-- Add new columns to the profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS target_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS target_calories numeric,
  ADD COLUMN IF NOT EXISTS target_protein numeric,
  ADD COLUMN IF NOT EXISTS target_carbs numeric,
  ADD COLUMN IF NOT EXISTS target_fat numeric;

-- Add a check constraint for the goal enum
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_goal_check 
  CHECK (goal IN ('Lose weight', 'Maintain weight', 'Gain weight', 'Just track my food'));
