-- Add stride length to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stride_length_cm numeric;

-- Add source and calculation_method to exercises
ALTER TABLE public.exercises
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS calculation_method text;
