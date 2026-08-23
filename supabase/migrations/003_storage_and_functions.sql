-- =============================================================================
-- 3. STORAGE
-- =============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('meal-images', 'meal-images', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'meal-images');
CREATE POLICY "Authenticated users can upload meal images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'meal-images' and auth.role() = 'authenticated');


-- =============================================================================
-- 4. RPC FUNCTIONS
-- =============================================================================

-- RPC to delete meal entry (replaces old food_entry delete)
CREATE OR REPLACE FUNCTION public.delete_meal_entry(p_meal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_entry record;
  v_entry_date date;
  v_summary record;
BEGIN
  -- Check authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify existence and ownership
  SELECT * INTO v_entry
  FROM public.meal_entries
  WHERE id = p_meal_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found or unauthorized';
  END IF;

  -- Extract entry date (in UTC to match ISO string date)
  v_entry_date := (v_entry.created_at AT TIME ZONE 'UTC')::date;

  -- Delete the meal entry (meal_food deleted automatically via cascade)
  DELETE FROM public.meal_entries
  WHERE id = p_meal_id AND user_id = v_user_id;

  -- Atomically update the daily summary with row-level lock (FOR UPDATE)
  SELECT * INTO v_summary
  FROM public.daily_summaries
  WHERE user_id = v_user_id AND summary_date = v_entry_date
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.daily_summaries
    SET
      total_calories = greatest(0, total_calories - coalesce(v_entry.calories, 0)),
      total_protein  = greatest(0, total_protein  - coalesce(v_entry.protein, 0)),
      total_carbs    = greatest(0, total_carbs    - coalesce(v_entry.carbs, 0)),
      total_fat      = greatest(0, total_fat      - coalesce(v_entry.fat, 0)),
      total_fiber    = greatest(0, total_fiber    - coalesce(v_entry.fiber, 0)),
      meal_count     = greatest(0, meal_count - 1),
      updated_at     = now()
    WHERE id = v_summary.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_meal_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_meal_entry(uuid) TO authenticated;

-- RPC for transactional insert of Meal + Foods
CREATE OR REPLACE FUNCTION public.insert_meal_transaction(
  p_meal_type text,
  p_meal_name text,
  p_calories numeric,
  p_protein numeric,
  p_carbs numeric,
  p_fat numeric,
  p_image_path text,
  p_raw_input jsonb,
  p_ai_response_json jsonb,
  p_foods jsonb -- Array of food item objects
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_meal_id uuid;
  v_food jsonb;
  v_meal_entry record;
  v_today date;
  v_summary record;
  v_recent record;
BEGIN
  -- Check authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_today := (now() AT TIME ZONE 'UTC')::date;

  -- 1. Insert into meal_entries
  INSERT INTO public.meal_entries (
    user_id, meal_type, meal_name, calories, protein, carbs, fat, 
    image_path, raw_input, ai_provider, ai_model, ai_response_json
  ) VALUES (
    v_user_id, p_meal_type, p_meal_name, p_calories, p_protein, p_carbs, p_fat,
    p_image_path, p_raw_input, 'google', 'gemini-3.5-flash', p_ai_response_json
  ) RETURNING * INTO v_meal_entry;

  v_meal_id := v_meal_entry.id;

  -- 2. Insert into meal_food
  IF jsonb_typeof(p_foods) = 'array' THEN
    FOR v_food IN SELECT * FROM jsonb_array_elements(p_foods)
    LOOP
      INSERT INTO public.meal_food (
        user_id, meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g
      ) VALUES (
        v_user_id,
        v_meal_id,
        (v_food->>'name')::text,
        (v_food->>'quantity')::numeric,
        (v_food->>'unit')::text,
        (v_food->>'calories')::numeric,
        (v_food->>'protein_g')::numeric,
        (v_food->>'carbs_g')::numeric,
        (v_food->>'fat_g')::numeric
      );
    END LOOP;
  END IF;

  -- 3. Upsert daily_summaries
  SELECT * INTO v_summary
  FROM public.daily_summaries
  WHERE user_id = v_user_id AND summary_date = v_today
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.daily_summaries
    SET
      total_calories = total_calories + p_calories,
      total_protein  = total_protein + p_protein,
      total_carbs    = total_carbs + p_carbs,
      total_fat      = total_fat + p_fat,
      meal_count     = meal_count + 1,
      updated_at     = now()
    WHERE id = v_summary.id;
  ELSE
    INSERT INTO public.daily_summaries (
      user_id, summary_date, total_calories, total_protein, total_carbs, total_fat, total_fiber, meal_count
    ) VALUES (
      v_user_id, v_today, p_calories, p_protein, p_carbs, p_fat, 0, 1
    );
  END IF;

  -- 4. Upsert recent_foods
  SELECT * INTO v_recent
  FROM public.recent_foods
  WHERE user_id = v_user_id AND meal_name ILIKE p_meal_name
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.recent_foods
    SET
      foods = p_foods,
      total_calories = p_calories,
      total_protein = p_protein,
      total_carbs = p_carbs,
      total_fat = p_fat,
      used_count = used_count + 1,
      last_used_at = now()
    WHERE id = v_recent.id;
  ELSE
    INSERT INTO public.recent_foods (
      user_id, meal_name, foods, total_calories, total_protein, total_carbs, total_fat, used_count, last_used_at
    ) VALUES (
      v_user_id, p_meal_name, p_foods, p_calories, p_protein, p_carbs, p_fat, 1, now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'meal_id', v_meal_id,
    'entry', row_to_json(v_meal_entry)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.insert_meal_transaction(text, text, numeric, numeric, numeric, numeric, text, jsonb, jsonb, jsonb) TO authenticated;
