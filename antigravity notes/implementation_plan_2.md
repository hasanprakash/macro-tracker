# Macro Tracker — Scan → Review → Save Architecture

This is a major overhaul of the meal logging flow. Currently, tapping a meal type opens a modal, the user enters text or scans, and the function does everything (Gemini call + DB insert) in one shot. We're splitting this into a two-step flow: **scan-food** (AI analysis) → user reviews/edits → **log-meal** (DB persist), plus adding recent foods, per-meal food lists, and a rich animated loader.

## User Review Required

> [!IMPORTANT]
> **New database table required:** A `recent_foods` table will be created to store previously logged meals per user, enabling the "Recent foods" / "Repeat yesterday" features. You will need to run the SQL migration in your local Supabase Studio.

> [!IMPORTANT]
> **Breaking change to `scan-food` and `log-meal`:** Both edge functions will be completely rewritten. `scan-food` becomes the Gemini caller (no DB writes). `log-meal` becomes a pure DB persist function (no Gemini call). The current `log-meal` logic is being split across the two.

## Open Questions

> [!NOTE]
> **Search food feature**: The "🔍 Search food" option in the add-food menu — should this search a public food database API (like USDA/OpenFoodFacts), or just search the user's own recent foods? For now I'll implement it as searching the user's recent foods. We can add an external API later.

> [!NOTE]
> **"Repeat yesterday" feature**: This will copy all meals from the previous day. Should it auto-confirm and save immediately, or show a review screen? For now I'll have it auto-save since those values were already confirmed previously.

---

## Proposed Changes

### 1. Database — New `recent_foods` table

#### [NEW] `recent_foods_migration.sql` (run in Supabase Studio)

Create a new table to cache previously confirmed meals for quick re-logging:

```sql
create table public.recent_foods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  meal_name text not null,
  foods jsonb not null,          -- array of { name, quantity, unit, calories, protein_g, carbs_g, fat_g }
  total_calories numeric not null default 0,
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
  used_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.recent_foods enable row level security;

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

grant select, insert, update on public.recent_foods to authenticated;
```

---

### 2. Edge Function — `scan-food` (Gemini AI analysis only)

#### [MODIFY] [index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/scan-food/index.ts)

Completely rewrite. This becomes the Gemini caller, taking the auth/Gemini-calling logic from the current `log-meal`:

- **Input**: `{ text?, image_base64?, meal_type? }` (text and image can be sent together)
- **Process**: Authenticate user → Validate input → Call Gemini 3.5 Flash → Parse response
- **Output**: Structured nutrition estimate (not saved to DB):
```json
{
  "meal_name": "Chicken Biryani",
  "foods": [
    { "name": "Chicken", "quantity": 150, "unit": "g", "calories": 250, "protein_g": 40, "carbs_g": 0, "fat_g": 8 },
    { "name": "Rice", "quantity": 200, "unit": "g", "calories": 300, "protein_g": 5, "carbs_g": 65, "fat_g": 3 }
  ],
  "totals": { "calories": 620, "protein_g": 28, "carbs_g": 72, "fat_g": 24 },
  "confidence": 0.92
}
```
- Updated Gemini prompt to return per-food-item breakdowns with numeric quantities and units

---

### 3. Edge Function — `log-meal` (DB persist only)

#### [MODIFY] [index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-meal/index.ts)

Completely rewrite. No Gemini call. Receives confirmed/edited values from the client:

- **Input**: `{ meal_type, meal_name, foods, totals, image_base64? }`
- **Process**: Authenticate user → Validate payload → Upload image (if any) → Insert into `food_entries` → Upsert `daily_summaries` → Upsert `recent_foods` → Return saved entry
- The `recent_foods` upsert: if a meal with the same `meal_name` exists for this user, increment `used_count` and update `last_used_at`; otherwise insert new

---

### 4. React Native — Home Screen overhaul

#### [MODIFY] [index.tsx](file:///c:/SDProjects/macro-tracker/mobile/app/(tabs)/index.tsx)

Major changes to the home screen:

- **Meal sections with logged foods**: Replace the 4 meal-type buttons with expandable sections showing logged foods per meal:
  ```
  BREAKFAST                         + Add
  🥚 Eggs + toast              380 kcal
  
  LUNCH                             + Add
  🍛 Chicken biryani           620 kcal
  
  SNACKS                            + Add
  (empty)
  
  DINNER                            + Add
  (empty)
  ```
- **Recent foods section**: Below the meal sections, show the user's recent foods (limit 5) with a quick "Add to [meal]" action
- **Fetch today's food entries** on load to populate the meal sections
- **Fetch recent foods** on load
- New state management for the multi-step flow: scan → review → save
- Remove the old `submitMealLog` one-shot function
- Add `scanFood` function (calls `scan-food` edge function)
- Add `saveMeal` function (calls `log-meal` edge function)

---

### 5. React Native — New Components

#### [NEW] [AddFoodModal.tsx](file:///c:/SDProjects/macro-tracker/mobile/components/AddFoodModal.tsx)

Replaces the current `MealLogModal`. Shows the 5 options when user taps (+) on a meal section:
- 🔍 Search food — searches user's recent foods
- 📷 Scan meal — opens camera
- ✍️ Describe meal — text input (can also attach photo)
- ⭐ Recent foods — shows recent foods list to quick-add
- 🔁 Repeat yesterday — copies yesterday's meals for this meal type

The "Describe meal" and "Scan meal" modes both allow combining text + image together (addresses task #5).

#### [NEW] [ScanningLoader.tsx](file:///c:/SDProjects/macro-tracker/mobile/components/ScanningLoader.tsx)

Animated, multi-step loading screen shown while Gemini analyzes:
```
🍛 Analyzing your meal...

✅ Identifying foods...
⏳ Estimating portions...
○  Calculating nutrition...
```
Steps progress on a timer to give the feeling of progress during the ~30s wait.

#### [NEW] [MealReviewModal.tsx](file:///c:/SDProjects/macro-tracker/mobile/components/MealReviewModal.tsx)

Shown after Gemini returns. Displays the AI estimate for user review/edit:
- Meal name at the top
- Table of foods with editable quantities:
  ```
  Food      Amount    Calories
  Chicken   150g      250 kcal   [edit]
  Rice      200g      300 kcal   [edit]
  Oil       15g        70 kcal   [edit]
  ```
- When user edits a quantity, calories and macros are recalculated proportionally on the client
- Total calories + macro summary at the bottom
- "Save Meal" button → calls `log-meal` edge function

#### [NEW] [MealSection.tsx](file:///c:/SDProjects/macro-tracker/mobile/components/MealSection.tsx)

Renders a single meal category (e.g. BREAKFAST) with:
- Title + icon + total kcal for that meal
- List of logged food items
- (+) Add button to trigger `AddFoodModal`

#### [MODIFY] [MealLogModal.tsx](file:///c:/SDProjects/macro-tracker/mobile/components/MealLogModal.tsx)

Will be deleted/replaced by the new `AddFoodModal`.

---

### 6. React Native — Type definitions

#### [NEW] [types.ts](file:///c:/SDProjects/macro-tracker/mobile/lib/types.ts)

Shared TypeScript interfaces used across components:
```typescript
interface FoodItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface MealEstimate {
  meal_name: string;
  foods: FoodItem[];
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  confidence: number;
}

interface FoodEntry {
  id: string;
  meal_type: string;
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface RecentFood {
  id: string;
  meal_name: string;
  foods: FoodItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  used_count: number;
  last_used_at: string;
}
```

---

## Summary of User Flow

```
User taps (+) on LUNCH
       ↓
AddFoodModal opens with 5 options
       ↓
User picks "📷 Scan meal" or "✍️ Describe meal"
       ↓
(Optional: user takes photo AND types description)
       ↓
ScanningLoader shown (animated steps)
       ↓
scan-food edge function → Gemini → returns estimate
       ↓
MealReviewModal shown (user can edit quantities)
       ↓
User taps "Save Meal"
       ↓
log-meal edge function → DB insert → recent_foods upsert
       ↓
Home screen refreshes, meal appears under LUNCH section
```

---

## Verification Plan

### Manual Verification
1. Run Supabase locally and verify `recent_foods` table creation
2. Test scan-food edge function with curl (text-only, image-only, text+image)
3. Test log-meal edge function with curl (confirm DB inserts work)
4. Test full flow on the React Native app:
   - Scan a meal → review → edit quantity → save
   - Describe a meal with text → review → save
   - Scan + describe together → review → save
   - Quick-add from recent foods
   - Verify daily summary updates
   - Verify meal sections show logged foods
