// =============================================================================
// Shared TypeScript types for Macro Tracker
// =============================================================================

/** User profile and goals from the profiles table */
export interface Profile {
  id: string;
  display_name: string | null;
  height_cm: number | null;
  gender: string | null;
  date_of_birth: string | null;
  activity_level: string | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  age: number | null;
  goal: string | null;
  target_calories: number | null;
  maintenance_calories: number | null;
  under_eating_threshold: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  target_steps: number | null;
}

/** A single food item with nutritional breakdown */
export interface FoodItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Aggregated totals for a meal */
export interface MealTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** The response from the scan-food edge function (Gemini estimate) */
export interface MealEstimate {
  meal_name: string;
  foods: FoodItem[];
  totals: MealTotals;
  confidence: number;
}

/** A food entry row from the meal_entries table */
export interface MealEntry {
  id: string;
  user_id: string;
  meal_type: string;
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  image_path: string | null;
  raw_input?: { foods?: FoodItem[] } | null;
  created_at: string;
  meal_food?: MealFood[];
}

/** A food item row from the meal_food table */
export interface MealFood {
  id: string;
  meal_id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** A recent food row from the recent_foods table */
export interface RecentFood {
  id: string;
  user_id: string;
  meal_name: string;
  foods: FoodItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  used_count: number;
  last_used_at: string;
  created_at: string;
}

/** An exercise logged by the user */
export interface ExerciseEntry {
  id: string;
  user_id: string;
  exercise_date: string;
  exercise_type: string;
  description: string | null;
  duration_minutes: number;
  steps_count: number;
  calories_burned: number;
  created_at: string;
}
