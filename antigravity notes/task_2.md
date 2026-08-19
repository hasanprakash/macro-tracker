# Macro Tracker — Implementation Tasks

## Database
- [ ] Create consolidated SQL migration file (food_entries, daily_summaries, recent_foods tables + RLS + policies)

## Edge Functions
- [ ] Rewrite `scan-food` (Gemini AI analysis only)
- [ ] Rewrite `log-meal` (DB persist only, no Gemini)

## React Native — Types
- [ ] Create `lib/types.ts` shared interfaces

## React Native — New Components
- [ ] Create `ScanningLoader.tsx` (animated multi-step loader)
- [ ] Create `MealReviewModal.tsx` (review/edit quantities before saving)
- [ ] Create `AddFoodModal.tsx` (5-option menu: search, scan, describe, recent, repeat yesterday)
- [ ] Create `MealSection.tsx` (per-meal food list with + Add button)

## React Native — Home Screen
- [ ] Overhaul `index.tsx` (meal sections, recent foods, two-step flow)
- [ ] Remove old `MealLogModal.tsx` usage
