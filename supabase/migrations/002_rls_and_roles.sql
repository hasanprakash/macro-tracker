-- =============================================================================
-- 2. ROW LEVEL SECURITY & GRANTS
-- =============================================================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- User Goals
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.user_goals TO authenticated;
CREATE POLICY "Users can view their own goals" ON public.user_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goals" ON public.user_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals" ON public.user_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Meal Entries
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE, UPDATE ON public.meal_entries TO authenticated;
CREATE POLICY "Users can insert their own meal entries" ON public.meal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own meal entries" ON public.meal_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own meal entries" ON public.meal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own meal entries" ON public.meal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Meal Food
ALTER TABLE public.meal_food ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE, UPDATE ON public.meal_food TO authenticated;
CREATE POLICY "Users can manage their own meal_food" ON public.meal_food FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Daily Summaries
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.daily_summaries TO authenticated;
CREATE POLICY "Users can insert their own daily summaries" ON public.daily_summaries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own daily summaries" ON public.daily_summaries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own daily summaries" ON public.daily_summaries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recent Foods
ALTER TABLE public.recent_foods ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.recent_foods TO authenticated;
CREATE POLICY "Users can view their own recent foods" ON public.recent_foods FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own recent foods" ON public.recent_foods FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recent foods" ON public.recent_foods FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Weight Logs
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_logs TO authenticated;
CREATE POLICY "Users can view their own weight logs" ON public.weight_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own weight logs" ON public.weight_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own weight logs" ON public.weight_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own weight logs" ON public.weight_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Exercises
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
CREATE POLICY "Users can view their own exercises" ON public.exercises FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own exercises" ON public.exercises FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own exercises" ON public.exercises FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own exercises" ON public.exercises FOR DELETE TO authenticated USING (auth.uid() = user_id);


