-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  height_cm NUMERIC,
  gender TEXT,
  date_of_birth DATE,
  activity_level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create food_entries table
CREATE TABLE public.food_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meal_type TEXT NOT NULL,
  meal_name TEXT NOT NULL,
  consumed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  
  calories NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  fiber NUMERIC DEFAULT 0,
  sugar NUMERIC DEFAULT 0,
  sodium NUMERIC DEFAULT 0,
  
  image_path TEXT,
  raw_input TEXT,
  
  ai_provider TEXT DEFAULT 'google',
  ai_model TEXT DEFAULT 'gemini-3.5-flash',
  ai_response_json JSONB,
  confidence NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create daily_summaries table
CREATE TABLE public.daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  summary_date DATE NOT NULL,
  
  total_calories NUMERIC DEFAULT 0,
  total_protein NUMERIC DEFAULT 0,
  total_carbs NUMERIC DEFAULT 0,
  total_fat NUMERIC DEFAULT 0,
  total_fiber NUMERIC DEFAULT 0,
  
  meal_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, summary_date)
);

-- Create weight_logs table
CREATE TABLE public.weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight NUMERIC NOT NULL,
  body_fat_percentage NUMERIC,
  muscle_mass NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_goals table
CREATE TABLE public.user_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_calories NUMERIC DEFAULT 2000,
  target_protein NUMERIC DEFAULT 150,
  target_carbs NUMERIC DEFAULT 200,
  target_fat NUMERIC DEFAULT 65,
  target_weight NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setup Storage for meal images
INSERT INTO storage.buckets (id, name, public) VALUES ('meal-images', 'meal-images', true) ON CONFLICT (id) DO NOTHING;

-- Policies for public buckets
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'meal-images');
CREATE POLICY "Authenticated users can upload meal images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'meal-images' AND auth.role() = 'authenticated');
