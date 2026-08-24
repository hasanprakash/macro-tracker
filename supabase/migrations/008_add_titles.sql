-- Add title to meal_entries
ALTER TABLE public.meal_entries ADD COLUMN IF NOT EXISTS title text;

-- Add title to exercises
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS title text;

-- Drop down to update views or functions if necessary
