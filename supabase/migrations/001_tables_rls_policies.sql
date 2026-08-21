-- =============================================================================
-- Macro Tracker — Consolidated Database Migration
-- =============================================================================
-- This file contains all table definitions, RLS policies, storage bucket, and grants.
-- Run this in Supabase Studio SQL Editor or via `supabase db reset`.
-- =============================================================================


-- =============================================================================
-- TABLE: profiles
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  height_cm numeric,
  gender text,
  date_of_birth date,
  activity_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- =============================================================================
-- TABLE: food_entries
-- =============================================================================
create table if not exists public.food_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
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
  ai_provider text default 'google',
  ai_model text default 'gemini-3.5-flash',
  ai_response_json jsonb,
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.food_entries enable row level security;
grant select, insert, delete, update on public.food_entries to authenticated;

create policy "Users can insert their own food entries"
  on public.food_entries for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view their own food entries"
  on public.food_entries for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can update their own food entries"
  on public.food_entries for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own food entries"
  on public.food_entries for delete to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- TABLE: daily_summaries
-- =============================================================================
create table if not exists public.daily_summaries (
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

alter table public.daily_summaries enable row level security;
grant select, insert, update on public.daily_summaries to authenticated;

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
create table if not exists public.recent_foods (
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

alter table public.recent_foods enable row level security;
grant select, insert, update on public.recent_foods to authenticated;

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


-- =============================================================================
-- TABLE: weight_logs
-- =============================================================================
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  weight numeric not null,
  body_fat_percentage numeric,
  muscle_mass numeric,
  recorded_at timestamptz not null default now()
);

alter table public.weight_logs enable row level security;
grant select, insert, update, delete on public.weight_logs to authenticated;

create policy "Users can view their own weight logs"
  on public.weight_logs for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own weight logs"
  on public.weight_logs for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own weight logs"
  on public.weight_logs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own weight logs"
  on public.weight_logs for delete to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- TABLE: user_goals
-- =============================================================================
create table if not exists public.user_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_calories numeric default 2000,
  target_protein numeric default 150,
  target_carbs numeric default 200,
  target_fat numeric default 65,
  target_weight numeric,
  updated_at timestamptz not null default now()
);

alter table public.user_goals enable row level security;
grant select, insert, update on public.user_goals to authenticated;

create policy "Users can view their own goals"
  on public.user_goals for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on public.user_goals for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on public.user_goals for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- =============================================================================
-- STORAGE: meal-images Bucket & Policies
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

create policy "Public Access"
  on storage.objects for select
  using (bucket_id = 'meal-images');

create policy "Authenticated users can upload meal images"
  on storage.objects for insert
  with check (bucket_id = 'meal-images' and auth.role() = 'authenticated');
