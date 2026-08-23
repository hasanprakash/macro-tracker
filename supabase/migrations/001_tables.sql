-- =============================================================================
-- Macro Tracker — Initial Schema & RLS Policies
-- =============================================================================

-- =============================================================================
-- 1. TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  height_cm numeric,
  gender text,
  date_of_birth date,
  activity_level text CHECK (activity_level IN ('Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Extra Active')),
  weight_kg numeric,
  target_weight_kg numeric,
  age integer,
  goal text CHECK (goal IN ('Lose weight', 'Maintain weight', 'Gain weight', 'Just track my food')),
  target_calories numeric,
  target_protein numeric,
  target_carbs numeric,
  target_fat numeric,
  maintenance_calories numeric,
  under_eating_threshold numeric,
  target_steps integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.user_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_calories numeric default 2000,
  target_protein numeric default 150,
  target_carbs numeric default 200,
  target_fat numeric default 65,
  target_weight numeric,
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.meal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  meal_type text not null default 'Unknown' CHECK (lower(meal_type) IN ('breakfast', 'lunch', 'dinner', 'snack', 'snacks', 'unknown')),
  meal_name text,
  notes text,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  sugar numeric not null default 0,
  sodium numeric not null default 0,
  image_path text,
  raw_input jsonb,
  ai_provider text default 'google',
  ai_model text default 'gemini-3.5-flash',
  ai_response_json jsonb,
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.meal_food (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  meal_id uuid references public.meal_entries(id) on delete cascade not null,
  name text not null,
  quantity numeric not null,
  unit text,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  summary_date date not null,
  total_calories numeric not null default 0,
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
  total_fiber numeric not null default 0,
  meal_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, summary_date)
);

CREATE TABLE IF NOT EXISTS public.recent_foods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  meal_name text not null,
  foods jsonb not null,
  total_calories numeric not null default 0,
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
  used_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  weight numeric not null,
  body_fat_percentage numeric,
  muscle_mass numeric,
  recorded_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_date date DEFAULT CURRENT_DATE,
  exercise_type text NOT NULL,
  description text,
  duration_minutes integer,
  steps_count integer,
  calories_burned numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

