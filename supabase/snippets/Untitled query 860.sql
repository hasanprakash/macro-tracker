-- =============================================================================
-- Macro Tracker — Consolidated Database Migration
-- =============================================================================
-- This file contains all table definitions, RLS policies, and grants.
-- Run this in Supabase Studio SQL Editor or via `supabase db reset`.
-- =============================================================================


-- =============================================================================
-- TABLE: food_entries
-- =============================================================================
create table if not exists public.food_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  meal_type text not null default 'Unknown',
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
  ai_provider text,
  ai_model text,
  ai_response_json jsonb,
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.food_entries enable row level security;

-- Permissions
grant select, insert on public.food_entries to authenticated;

-- RLS Policies
create policy "Users can insert their own food entries"
  on public.food_entries for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view their own food entries"
  on public.food_entries for select to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- TABLE: daily_summaries
-- =============================================================================
create table if not exists public.daily_summaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
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

alter table public.daily_summaries enable row level security;

-- Permissions
grant select, insert, update on public.daily_summaries to authenticated;

-- RLS Policies
create policy "Users can insert their own daily summaries"
  on public.daily_summaries for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view their own daily summaries"
  on public.daily_summaries for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can update their own daily summaries"
  on public.daily_summaries for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- =============================================================================
-- TABLE: recent_foods
-- =============================================================================
-- Stores previously confirmed meals per user for quick re-logging.
-- The "foods" column is a JSONB array of:
--   { name, quantity, unit, calories, protein_g, carbs_g, fat_g }
-- =============================================================================
create table if not exists public.recent_foods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
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

alter table public.recent_foods enable row level security;

-- Permissions
grant select, insert, update on public.recent_foods to authenticated;

-- RLS Policies
create policy "Users can view their own recent foods"
  on public.recent_foods for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own recent foods"
  on public.recent_foods for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own recent foods"
  on public.recent_foods for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


grant delete on public.food_entries to authenticated;

create policy "Users can delete their own food entries"
  on public.food_entries for delete to authenticated
  using (auth.uid() = user_id);