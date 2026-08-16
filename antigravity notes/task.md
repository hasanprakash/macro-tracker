# Meal Logger Implementation Tasks

- `[x]` **Database Schema**
  - `[x]` Create `init_schema` migration file.
  - `[x]` Define `profiles`, `food_entries`, `daily_summaries`, `weight_logs`, `user_goals` tables.
  - `[x]` Set up `meal-images` storage bucket in Supabase.
- `[x]` **Edge Function (`log-meal`)**
  - `[x]` Update function to accept both `text` and `image` (base64) inputs.
  - `[x]` Update Gemini prompt to enforce strict JSON output format.
  - `[x]` Implement image upload to `meal-images` bucket.
  - `[x]` Insert the new meal entry into `food_entries`.
  - `[x]` Update `daily_summaries` table for the user.
- `[x]` **Mobile App Updates**
  - `[x]` Install `expo-image-picker`.
  - `[x]` Refactor `index.tsx` into modular components (`DailySummaryCard`, `MealCard`, `MealLogModal`).
  - `[x]` Integrate camera functionality for "Scan Food".
  - `[x]` Wire the modal "Submit" / Camera result to invoke the `log-meal` edge function.
  - `[x]` Dynamically fetch and display `daily_summaries` data on the Home Screen.
