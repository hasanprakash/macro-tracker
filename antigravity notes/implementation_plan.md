# Add Meal Logging UI and Gemini Integration

The goal is to update the home page to prominently display daily macros, add specific sections for logging meals (Breakfast, Lunch, Dinner, Snacks), and implement an intuitive modal to choose between scanning or entering text to log a meal. We will also update the `log-meal` Supabase edge function to correctly accept this text and prompt Gemini for macronutrient information.

## User Review Required

> [!WARNING]
> **Database Persistence**
> The current request mentions that we will later create the DB in Supabase to store the macros. For this implementation, the macros returned by Gemini will be added to the local state (updating the UI's Daily Summary immediately), but they will reset upon refreshing the app until we build the database integration. Is this acceptable for now?

## Open Questions

> [!IMPORTANT]
> **Scan Food**
> You mentioned "scanning food". For the UI, we will provide a "Scan Food" button inside the new logging modal. Should this button just show a placeholder "Coming soon" alert for now, or do you have a specific camera/scanning component already in mind?

## Proposed Changes

### Mobile UI (`mobile`)

#### [MODIFY] [index.tsx](file:///c:/SDProjects/macro-tracker/mobile/app/(tabs)/index.tsx)
- Update the **Daily Summary Card** colors to be lighter and cleaner (e.g., light gray/white background, darker text) per the "simple light colors" requirement.
- Add local state for `calories`, `carbs`, `protein`, and `fat` to dynamically update the summary card when a meal is logged.
- Replace the current "Quick Actions" and "Recent Meals" with a new **Meals** section. This will contain styled cards for **Breakfast**, **Lunch**, **Dinner**, and **Snacks**.
- Add a **Meal Logging Modal**. When a meal card is pressed, this modal slides up.
- The modal will have two initial options: `Scan Food` and `Enter Text`.
- Selecting `Enter Text` will reveal a text input for the user to type their meal (with optional quantity) and a `Submit` button.
- The `Submit` button will invoke the `log-meal` Supabase edge function with the typed text, parse the returned JSON macros, and update the Daily Summary state.

### Supabase Edge Functions (`supabase`)

#### [MODIFY] [log-meal/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-meal/index.ts)
- Update the function to accept a `POST` body containing `mealDescription`.
- Change the Gemini API request to use the `generateContent` endpoint (or `interactions` if preferred, but `generateContent` is standard for text generation).
- Update the prompt to Gemini: Instruct the model to analyze the `mealDescription` and return a strict JSON object with numerical values for `calories`, `carbs`, `proteins`, and `fats`.
- Return this structured JSON back to the mobile app.

## Verification Plan

### Manual Verification
1. Open the mobile app. Verify the new lighter colors on the Daily Summary card.
2. Verify the 4 new meal cards are visible.
3. Tap "Breakfast" -> tap "Enter Text" -> type "1 large apple and 2 eggs" -> tap "Submit".
4. Ensure the `log-meal` edge function is invoked successfully, returns macros, and updates the Daily Summary UI dynamically.
