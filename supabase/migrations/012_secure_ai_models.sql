-- =============================================================================
-- Migration: Secure AI Models
-- Creates a private table to assign AI models per user
-- Client apps cannot read or write to this table due to empty RLS policies.
-- Only Edge Functions using SERVICE_ROLE can access it.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_ai_models (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_model text not null default 'gemini-3.6-flash',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
ALTER TABLE public.user_ai_models ENABLE ROW LEVEL SECURITY;

-- Intentionally DO NOT create any policies. 
-- This completely prevents the anon/authenticated web clients from reading or modifying the table.
-- Supabase Service Role key will bypass RLS.

-- Trigger function to automatically create a row for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_ai_model()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_ai_models (user_id, ai_model)
  VALUES (new.id, 'gemini-3.6-flash');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_assign_ai_model ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_ai_model
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_ai_model();


