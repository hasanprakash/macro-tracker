# Implementation Plan: End-to-End Idempotency & Concurrency Safety

This plan details the implementation of production-grade **Idempotency** across all 5 critical areas of Macro Tracker. It ensures network timeouts, client retries, double-taps, and background sync jobs never cause duplicate data, corrupted calorie summaries, or wasted AI rate limits.

---

## User Review Required

> [!IMPORTANT]
> **Database Migration (`016_idempotency_and_constraints.sql`)**:
> - Updates `insert_meal_transaction` to accept an optional `p_meal_id` (UUID) and re-aggregate `daily_summaries` directly from `SUM(meal_entries)`.
> - Updates `delete_meal_entry` to also recalculate `daily_summaries` using `SUM(meal_entries)` for 100% mathematical consistency.
> - Adds a `log_date date NOT NULL DEFAULT CURRENT_DATE` column to `weight_logs` with a `UNIQUE (user_id, log_date)` constraint.
> - Adds an `external_id text` column to `exercises` with a `UNIQUE (user_id, external_id)` constraint for background health sync deduplication.

---

## Proposed Changes

### 1. Database Layer (Supabase PostgreSQL)

#### [NEW] [016_idempotency_and_constraints.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/016_idempotency_and_constraints.sql)
1. **Weight Logs Unique Daily Constraint**:
   - Add `log_date date NOT NULL DEFAULT CURRENT_DATE` to `weight_logs`.
   - Add unique index `UNIQUE (user_id, log_date)` so daily weights are strictly upserted.
2. **Exercises External ID Constraint**:
   - Add `external_id text` to `exercises`.
   - Add unique index `UNIQUE (user_id, external_id)` to allow idempotent wearable/step syncing.
3. **Idempotent `insert_meal_transaction` RPC**:
   - Accept optional `p_meal_id uuid DEFAULT NULL`.
   - If `p_meal_id` already exists for `auth.uid()`, return the existing meal immediately (`'idempotent_replay': true`) without double-counting or re-incrementing.
   - Insert new meal using `p_meal_id` (or fallback to `gen_random_uuid()`).
   - Recalculate `daily_summaries` from `SELECT SUM(calories), SUM(protein), SUM(carbs), SUM(fat), COUNT(*) FROM meal_entries WHERE ...` using `ON CONFLICT (user_id, summary_date) DO UPDATE`.
4. **Idempotent `delete_meal_entry` RPC**:
   - Delete entry and recalculate `daily_summaries` from `SUM()` of remaining `meal_entries` for that day.

---

### 2. Backend / Edge Functions Layer

#### [MODIFY] [supabase/functions/log-meal/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-meal/index.ts)
- Accept `meal_id` / `idempotency_key` in request body.
- Pass `p_meal_id` to `insert_meal_transaction`.
- Return HTTP 200 with `entry` and idempotent status.

#### [MODIFY] [supabase/functions/scan-food/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/scan-food/index.ts)
- Accept `x-idempotency-key` header or `idempotency_key` body parameter.
- Check Upstash Redis cache for `idempotent:scan-food:<userId>:<key>`.
- If cache hit: return cached Gemini response without deducting rate limit or calling Gemini again.
- If cache miss: call Gemini, cache successful response in Redis for 10 minutes (TTL = 600s), and return.

#### [MODIFY] [supabase/functions/log-exercise/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-exercise/index.ts)
- Accept `x-idempotency-key` / `idempotency_key`.
- Check Redis cache for `idempotent:log-exercise:<userId>:<key>`.
- Cache successful response for 10 minutes.

---

### 3. Mobile Client Layer (React Native / Expo)

#### [MODIFY] [mobile/app/(tabs)/index.tsx](file:///c:/SDProjects/macro-tracker/mobile/app/%28tabs%29/index.tsx)
1. **Meal Saving**:
   - Generate client UUID when preparing review modal (`Crypto.randomUUID()`).
   - Pass `meal_id` into `supabase.functions.invoke('log-meal')`.
2. **Weight Logging**:
   - Replace `if (todaysWeight) update else insert` with a single atomic PostgreSQL `UPSERT`:
     ```ts
     await supabase.from('weight_logs').upsert({
       user_id: userId,
       weight,
       log_date: selectedDate,
     }, { onConflict: 'user_id,log_date' });
     ```
3. **Health Connect Steps Syncing**:
   - Set `external_id: `health_connect_steps_${syncDate}``.
   - Use atomic `UPSERT` with `onConflict: 'user_id,external_id'`.
4. **AI Food / Exercise Scan**:
   - Send `idempotency_key` with image/text scan requests to prevent re-billing on retry.

#### [MODIFY] [mobile/components/MealReviewModal.tsx](file:///c:/SDProjects/macro-tracker/mobile/components/MealReviewModal.tsx)
- Ensure a consistent `clientMealId` is generated per review session and passed to `onSave`.

---

## Verification Plan

### Automated Database & Script Verification
1. **Idempotent Meal Replay Test**:
   - Call `insert_meal_transaction` with the same `p_meal_id` 3 times in a row.
   - Verify that only **1 row** exists in `meal_entries` and `daily_summaries.total_calories` is incremented exactly once.
2. **Daily Summary Truth Test**:
   - Insert 3 meals, delete 1 meal. Verify `daily_summaries` matches `SELECT SUM(calories) FROM meal_entries` with 0 drift.
3. **Weight Upsert Test**:
   - Call weight log upsert twice for the same date with different weights. Verify only **1 row** exists for that date with the latest weight.
4. **Health Connect Sync Test**:
   - Trigger `syncStepsToDB` 5 times concurrently for the same date. Verify exactly **1 row** exists in `exercises`.
5. **AI Cache Replay Test**:
   - Invoke `scan-food` twice with the same idempotency key. Verify the second call returns with `X-Cache: HIT` and 0 rate limit deduction.

### Type & Build Verification
- Run `npx.cmd tsc --noEmit` on the mobile project to ensure 100% clean compilation.
