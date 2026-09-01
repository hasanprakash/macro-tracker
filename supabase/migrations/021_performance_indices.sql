-- =============================================================================
-- Migration 021: Production Performance Indices
-- =============================================================================

-- 1. Foreign Key Join Index: meal_food -> meal_entries
-- Accelerates "meal_entries select *, meal_food(*)" relational joins
CREATE INDEX IF NOT EXISTS idx_meal_food_meal_id ON public.meal_food(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_food_user_id ON public.meal_food(user_id);

-- 2. Daily Dashboard & History Indices: meal_entries
-- Speeds up compound filtering on (user_id, summary_date) with created_at ordering
CREATE INDEX IF NOT EXISTS idx_meal_entries_user_summary_created 
  ON public.meal_entries(user_id, summary_date, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_meal_entries_user_created_at 
  ON public.meal_entries(user_id, created_at ASC);

-- 3. Exercise Lookups: exercises
-- Speeds up daily exercise retrieval for (user_id, exercise_date)
CREATE INDEX IF NOT EXISTS idx_exercises_user_date 
  ON public.exercises(user_id, exercise_date);

-- 4. Analytics & Charting: weight_logs
-- Speeds up 30-day dynamic window and chronological weight history
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_recorded 
  ON public.weight_logs(user_id, recorded_at ASC);

-- 5. Recent Foods Fast-Retrieval: recent_foods
-- Optimizes "ORDER BY last_used_at DESC LIMIT 10" queries
CREATE INDEX IF NOT EXISTS idx_recent_foods_user_last_used 
  ON public.recent_foods(user_id, last_used_at DESC);

-- 6. AI Model & Key Lookup: user_ai_settings
CREATE INDEX IF NOT EXISTS idx_user_ai_settings_user_id 
  ON public.user_ai_settings(user_id);
