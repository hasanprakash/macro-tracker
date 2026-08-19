// =============================================================================
// Shared TypeScript types for Macro Tracker
// =============================================================================

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

/** A food entry row from the food_entries table */
export interface FoodEntry {
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
  created_at: string;
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
