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
  p_foods jsonb, -- Array of food item objects
  p_title text DEFAULT NULL
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
    user_id, meal_type, meal_name, title, calories, protein, carbs, fat, 
    image_path, raw_input, ai_provider, ai_model, ai_response_json
  ) VALUES (
    v_user_id, p_meal_type, p_meal_name, COALESCE(p_title, p_meal_name), p_calories, p_protein, p_carbs, p_fat,
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

  -- 3. Upsert daily_summaries (kept from original)
  INSERT INTO public.daily_summaries (
    user_id, summary_date, total_calories, total_protein, total_carbs, total_fat
  ) VALUES (
    v_user_id, v_today, p_calories, p_protein, p_carbs, p_fat
  )
  ON CONFLICT (user_id, summary_date) DO UPDATE SET
    total_calories = public.daily_summaries.total_calories + EXCLUDED.total_calories,
    total_protein = public.daily_summaries.total_protein + EXCLUDED.total_protein,
    total_carbs = public.daily_summaries.total_carbs + EXCLUDED.total_carbs,
    total_fat = public.daily_summaries.total_fat + EXCLUDED.total_fat,
    updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_summary;

  -- 4. Upsert recent_foods (kept from original)
  INSERT INTO public.recent_foods (
    user_id, meal_name, foods, total_calories, total_protein, total_carbs, total_fat, used_count
  ) VALUES (
    v_user_id, p_meal_name, p_foods, p_calories, p_protein, p_carbs, p_fat, 1
  )
  ON CONFLICT ON CONSTRAINT recent_foods_user_id_meal_name_key DO UPDATE SET
    foods = EXCLUDED.foods,
    total_calories = EXCLUDED.total_calories,
    total_protein = EXCLUDED.total_protein,
    total_carbs = EXCLUDED.total_carbs,
    total_fat = EXCLUDED.total_fat,
    used_count = public.recent_foods.used_count + 1,
    last_used_at = timezone('utc'::text, now())
  RETURNING * INTO v_recent;

  RETURN jsonb_build_object(
    'entry', row_to_json(v_meal_entry),
    'summary', row_to_json(v_summary),
    'recent', row_to_json(v_recent)
  );
END;
$$;
