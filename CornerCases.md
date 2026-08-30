# Production Architecture & Resilience Guide

This document covers rate limiting policies, corner cases, caching, database indexing, and resilience strategies implemented across Macro Tracker.

---

## 1. Rate Limiting Configuration & Limits

### Per-User Limits:
- **`log-meal`**:
  - Burst Limit: `10 requests / minute`
  - Daily Limit: `30 meal logs / day`
- **`scan-food`**:
  - Edge Burst Limit: `5 requests / minute`
  - Edge Daily Limit: `15 requests / day`
  - AI Gemini Quota: `3 requests / minute`, `6 requests / day` (Free tier; bypassed if user provides their own Gemini API key via BYOK)
- **`log-exercise`**:
  - Edge Burst Limit: `5 requests / minute`
  - Edge Daily Limit: `15 requests / day`
  - AI Gemini Quota: `3 requests / minute`, `6 requests / day` (Free tier; bypassed via BYOK)

### Global Limits (Sybil / DDoS Protection):
- **`GLOBAL_LIMIT_PER_MINUTE`**: `100 requests / minute` across all users per edge function.
- Protects against distributed/sybil attacks where an attacker spins up multiple fake accounts to flood backend infrastructure.

---

## 2. Request Processing Pipeline & Early Validation

### Request Order in Edge Functions:
1. **Early Request Size Validation**: Rejects any request payload $> 3\text{ MB}$ (`3,145,728 bytes`) with `HTTP 413 Payload Too Large` before Deno allocates memory.
2. **CORS & Authentication**: Verifies valid JWT token and extracts `user.id` and client `IP`.
3. **Global & Burst Rate Limiting**: Evaluates Upstash Redis rate limits (`100/min global`, `5/min burst`, `15/day edge`) **before** making any database lookups or AI calls.
4. **Idempotency Cache Check**: Checks Redis for `idempotent:<fn>:<user_id>:<key>`. If cached, returns estimate immediately in $< 20\text{ ms}$ (`X-Cache: HIT`).
5. **Database Settings Query**: Checks `user_ai_settings` for custom API keys only *after* passing burst limit.
6. **AI Quota Check**: Enforces 3/min and 6/day for free users (bypassed if custom API key is present).
7. **Gemini / DB Execution**: Executes core logic and caches result with 10-minute TTL.

---

## 3. BYOK (Bring Your Own Key) Configuration

- By default, `byok_enabled` is set to `true` (via Migration `017_default_byok_true.sql`).
- All new and existing users have the option to enter their personal Gemini API key under **Settings**.
- When a custom key is saved, AI rate limits are automatically bypassed.

---

## 4. Resilience & "Fail-Open" Strategy

- All Upstash Redis rate-limiting operations are wrapped in `try/catch` handlers.
- If Upstash Redis experiences network timeouts or downtime, the error is logged as a warning (`console.warn`) and the request is **allowed through** ("Fail-Open").
- This guarantees that third-party Redis latency will never take down core app functionality for legitimate users.

---

## 5. Answers to Architecture Questions

### Q: "If we are making a call to DB before checking rate limits, is that a problem?"
> **Resolved**: Yes, in earlier iterations `user_ai_settings` was queried before rate limiting. We have re-architected all edge functions to perform **request size validation and edge function burst rate limiting first** before touching PostgreSQL. This protects the database connection pool from spam attacks.

### Q: "We are making Supabase DB calls directly from React Native. Are they protected from rate limits?"
> **Answer**: Yes. Supabase's infrastructure layer (Kong API Gateway, PostgREST, and Supavisor connection pooling) provides global DDoS and rate limiting protections. Furthermore:
> 1. **PostgreSQL RLS (Row-Level Security)** ensures users can only read/write their own records.
> 2. **PostgreSQL Constraints & Atomic UPSERTs** (e.g. `UNIQUE (user_id, log_date)` on `weight_logs` and `UNIQUE (user_id, external_id)` on `exercises`) prevent duplicate data.
> 3. **Application Limits** (e.g., max 5 entries per meal type) are checked on both client and database transactions.

### Q: "Should I give the user the exact time when they can retry when hitting rate limits?"
> **Answer**: Yes! All edge functions return standard `Retry-After` headers and `retry_after_seconds` in the response JSON. The mobile app automatically formats this into friendly human-readable strings (e.g., *"Resets in 3 hours, or add your own API key in Settings for unlimited scans"* with a direct button to navigate to Settings).

---

## 6. Redis Latency Optimization & Cold Socket Mitigation

### Why Redis was taking 487ms after idle periods:
1. **Sequential HTTP Waterfall**: Previously, the function executed 3 separate sequential round-trips over HTTPS: `await globalLimiter` $\to$ `await burstLimiter` $\to$ `await dailyLimiter` ($3 \times \text{RTT}$).
2. **Cold Socket Reconnects**: After waiting a few minutes, the TCP connection and TLS session to Upstash timed out. The next request had to perform a DNS lookup + TCP 3-way handshake + TLS 1.3 handshake before executing 3 sequential REST calls.
3. **Per-Request Instantiation**: Instantiating `new Ratelimit(...)` and `new Map()` inside the request handler meant the in-memory `ephemeralCache` was always wiped empty on every request.

### The Fixes Applied:
1. **Parallel `Promise.all`**: All rate limiters now execute in parallel in a single concurrent network round-trip ($3\times \text{RTT} \to 1\times \text{RTT}$, reducing network latency by up to 66%).
2. **Module-Scoped Singletons**: Initializing `Redis` and `Ratelimit` instances at module scope keeps TCP keep-alive connections warm across requests in the Deno isolate.
3. **Persistent Ephemeral Cache**: In-memory `ephemeralCache` maps now persist across requests, allowing repeated rate-limit checks to resolve in **0ms** without touching the network.

---

## 7. Binary Streaming & Real-Time Upload Progression

### Binary `multipart/form-data` vs Base64 JSON:
- **0% Data Bloat**: Moving to binary `FormData` eliminates Base64's 33% string overhead.
- **Zero JS Heap Memory Spikes**: The phone streams raw binary bytes directly from device storage without allocating megabyte strings in the Hermes JS runtime.
- **Deno Multipart Support**: `scan-food` parses both `multipart/form-data` and `application/json` with zero third-party dependencies.

### Exact Real-Time Network Callback:
- The mobile app uses `XMLHttpRequest.upload.onload` via [`invokeScanFoodWithProgress`](file:///c:/SDProjects/macro-tracker/mobile/lib/scan.ts).
- The exact millisecond the phone finishes sending the binary bytes across the network socket, `isUploaded = true` fires.
- [`ScanningLoader`](file:///c:/SDProjects/macro-tracker/mobile/components/ScanningLoader.tsx) checks off `✅ Uploaded photo` instantly and moves to `🔍 Identifying foods...`.

---

## 8. Calorie Intake Alerts & Thresholds

### 1. Under-Eating Threshold & BMR Override:
- **Condition**: `calories < under_eating_threshold`
- **Calculation Rule**:
  - Default: `under_eating_threshold = calculated_BMR` (e.g. 1369 kcal).
  - Calculated Maintenance: `maintenance_calories = calculated_BMR * 1.2` (e.g. 1643 kcal).
  - **Below-BMR Override**: When a user overrides target calories below their BMR (e.g. chooses 1300 kcal), `under_eating_threshold` is set to the user's override (1300 kcal), while `maintenance_calories` remains strictly preserved at the formula calculation (`1369 * 1.2 = 1643 kcal`).
- **Visuals**:
  - Calorie Ring: Red (`#EF4444`) when `calories < under_eating_threshold`
  - Icon: Gentle breathing `information-circle` in Red (`#EF4444`)
- **Action on Tap**: Shows educational modal explaining exact calories needed to reach the threshold (`under_eating_threshold - calories`) and risks of under-eating.

### 2. Over-Eating Caution (500 kcal – 600 kcal surplus above maintenance):
- **Condition**: `calories - maintenance_calories >= 500 && surplus <= 600`
- **Visuals**:
  - Calorie Ring: Dangerous Electric Purple (`#A855F7`)
  - Icon: Gentle breathing `information-circle` in Purple (`#A855F7`)
- **Action on Tap**: Shows "Time to Slow Down!" alert guiding the user to pace intake.

### 3. Over-Eating High Surplus Alert (> 600 kcal surplus above maintenance):
- **Condition**: `calories - maintenance_calories > 600`
- **Visuals**:
  - Calorie Ring: Dangerous Intense Purple (`#9333EA`)
  - Icon: Gentle breathing `warning` in Purple (`#A855F7`)
- **Action on Tap**: Shows "High Calorie Surplus Alert!" advising user to halt further intake and reset fresh tomorrow.

---

## 9. Zero-Calorie Meal & Food Prevention

### Multi-Layer Defense:
1. **Mobile UI Review Modal**:
   - Items reduced to 0 quantity / 0 calories are excluded from the save payload.
   - If total calories reaches 0, the Save button switches to "Discard Meal" (in Create mode) or "Delete Meal" (in Edit mode).
2. **Edge Function (`log-meal`)**:
   - Validates `validFoods.length > 0` and `total_calories > 0`.
   - Rejects zero-calorie payloads with `HTTP 400 Bad Request`.
3. **Database Transaction (`insert_meal_transaction`)**:
   - Enforces `p_calories > 0`.
   - Filters out any `0` or negative calorie / quantity items inside `FOR v_food IN SELECT * FROM jsonb_array_elements(p_foods)`.
   - Never saves 0-calorie food items to `meal_food` or `recent_foods`.

---

## 10. Animation & Haptic Feedback Guarding

### State Preservation on Non-Macro Updates:
- [`DailySummaryCard`](file:///c:/SDProjects/macro-tracker/mobile/components/DailySummaryCard.tsx) and [`CountingNumber`](file:///c:/SDProjects/macro-tracker/mobile/components/DailySummaryCard.tsx#L24) maintain `prevMetricsRef` and `isFirstLoadRef`.
- **What this prevents**:
  - Updating weight in `LogWeightModal` or `Settings` updates the user's profile state, but does not alter meal macros.
  - Previously, prop updates triggered the full 16-step haptic vibration sequence and wiped the progress rings to 0.
  - Now, if calories, protein, carbs, and fat have not changed, the component skips the entrance animation and suppresses haptic feedback completely.

---

## 11. Additional Corner Cases & Best Practices

### Caching:
- Successful AI estimates from `scan-food` and `log-exercise` are cached in Redis for 10 minutes (`TTL = 600s`) keyed by `(user_id, idempotency_key)`.
- Replaying a dropped request serves cached data in $< 20\text{ ms}$ without consuming rate limit quota or incurring Gemini costs.

### Database Indexing:
- `weight_logs`: `UNIQUE (user_id, log_date)` for atomic daily upserts.
- `exercises`: `UNIQUE (user_id, external_id)` for wearable / Health Connect deduplication.
- `meal_entries`: Indexed on `(user_id, created_at)` for fast daily summary aggregations.
- `daily_summaries`: `UNIQUE (user_id, summary_date)` with true-sum recalculation.

### Circuit Breakers:
- Gemini API errors (503 High Demand / Overloaded) are caught and transformed into user-friendly messages rather than crashing the mobile app or raw edge function errors.
