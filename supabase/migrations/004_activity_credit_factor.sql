-- Add activity_credit_factor to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS activity_credit_factor numeric DEFAULT 0.70;
