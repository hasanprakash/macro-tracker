# 🔍 Macro Tracker — Full Codebase Audit

Comprehensive review covering security, data access, performance, scalability, and production readiness.

---

## 🔴 CRITICAL — Security Issues

### 1. API Keys Stored as Plaintext in Database
**Files:** [013_byok_and_profiles.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/013_byok_and_profiles.sql#L19), [scan-food/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/scan-food/index.ts#L105)

**Problem:** User-provided Gemini API keys (`custom_api_key`) are stored as plain text in the `user_ai_settings` table. Anyone with service-role access, a database backup leak, or a SQL injection path can read every user's API key verbatim. The UI even tells the user their key is "encrypted" — it's not.

**Why it matters:** If the database is ever compromised, all user API keys are immediately usable by the attacker. Users trust you with their billing-linked credentials.

**Fix:** Encrypt API keys at rest using `pgcrypto` (`pgp_sym_encrypt`/`pgp_sym_decrypt`) with a server-side secret, or use Supabase Vault. Only decrypt inside the Edge Function when calling Gemini.

---

### 2. `SECURITY DEFINER` Functions Run as the Owner (Superuser Bypass)
**Files:** [003_storage_and_functions.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/003_storage_and_functions.sql#L18), [014_atomic_meal_limit.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/014_atomic_meal_limit.sql#L16), [013_byok_and_profiles.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/013_byok_and_profiles.sql#L72)

**Problem:** All your RPC functions are `SECURITY DEFINER`. This means they run with the **owner's** (typically `postgres` superuser) privileges, completely bypassing RLS. While you manually check `auth.uid()` inside, any bug in the function body could bypass all table-level security.

**Why it matters:** A single logic mistake (e.g., forgetting to check ownership in a new function) gives any authenticated user full access to all rows. `SECURITY DEFINER` is the database equivalent of running code as root.

**Fix:** Where possible, switch to `SECURITY INVOKER` and rely on RLS. Only use `SECURITY DEFINER` where absolutely necessary (e.g., cross-table atomic operations), and audit each function's ownership checks meticulously.

---

### 3. Edge Functions Have JWT Verification Disabled
**File:** [config.toml](file:///c:/SDProjects/macro-tracker/supabase/config.toml#L4)

**Problem:** All three Edge Functions (`scan-food`, `log-meal`, `log-exercise`) have `verify_jwt = false`. This means Supabase does NOT validate the JWT before the function runs — anyone who knows the function URL can hit it. Your functions do their own auth check, but:
- The `Authorization` header could be spoofed with an expired/invalid token format.
- You're doing `authorization.substring(7)` without verifying the token is actually a `Bearer` token.

**Why it matters:** An attacker can flood your Edge Functions without a valid token, burning your Gemini API quota and Upstash rate-limit capacity. Even though the auth check *should* catch it, the function still initialises a Supabase client and attempts DB operations before failing.

**Fix:** Set `verify_jwt = true` in `config.toml`. Supabase will reject invalid JWTs before your function code even runs, saving resources. Your own auth checks serve as a defence-in-depth layer.

---

### 4. CORS Allows All Origins (`*`)
**Files:** [scan-food/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/scan-food/index.ts#L6), [log-meal/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-meal/index.ts#L4), [log-exercise/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-exercise/index.ts#L5)

**Problem:** `Access-Control-Allow-Origin: '*'` allows any website or app to call your edge functions. Since this is a mobile app, there's no legitimate cross-origin scenario.

**Why it matters:** A malicious website could make requests to your Edge Functions using a stolen or session-hijacked token from a user's browser.

**Fix:** Remove CORS headers entirely (mobile apps don't use CORS), or lock them down to your specific domain if you ever add a web client.

---

### 5. Meal Images Bucket is Publicly Readable
**File:** [003_storage_and_functions.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/003_storage_and_functions.sql#L5-L7)

**Problem:** The `meal-images` storage bucket is set to `public = true` with a blanket SELECT policy. **Any person on the internet** can view any user's meal photos if they know (or guess) the file path. The file path pattern is `{user_id}/{timestamp}.jpg` — easily enumerable.

**Why it matters:** User diet photos are personal data. A food photo can reveal medical conditions (diabetes-friendly diet, allergies), location (restaurant-specific dishes), and lifestyle. This is a privacy violation, especially under GDPR/Play Store policies.

**Fix:** Set the bucket to `private`, add an RLS policy that limits reads to `auth.uid() = (storage.foldername(name))[1]::uuid`, and serve images via signed URLs with short expiration.

---

### 6. Supabase Temp Files Committed to Git
**Git tracked files:** `supabase/.temp/project-ref`, `supabase/.temp/linked-project.json`, `supabase/.temp/pooler-url`, etc.

**Problem:** Your Supabase project reference (`oakkfndpfsbusdcfozyv`), organization ID, and internal metadata are tracked in git. Combined with the cloud Supabase URL visible in `.env.example`, this reveals your full project configuration.

**Why it matters:** While this doesn't expose secrets directly, it gives attackers the exact project to target. It also leaks your personal email (`hasanchadaram888@gmail.com`) from `linked-project.json`.

**Fix:** Add `supabase/.temp/` to `.gitignore` and remove from tracking with `git rm -r --cached supabase/.temp/`.

---

## 🟡 HIGH — Data Access & Authorization Issues

### 7. No Input Validation or Sanitization on RPC Parameters
**Files:** [014_atomic_meal_limit.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/014_atomic_meal_limit.sql), [003_storage_and_functions.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/003_storage_and_functions.sql)

**Problem:** `insert_meal_transaction` accepts arbitrary numeric values for calories, protein, carbs, fat with no bounds checking. A user can submit:
- **Negative values**: `-99999` calories, corrupting their daily summary
- **Extreme values**: `999999999` calories, overflowing UI displays
- The `p_foods` JSONB array is never validated for structure — a malformed payload could insert garbage data

**Why it matters:** This is a direct client manipulation vector. On a mobile app, anyone with an HTTP client (Postman, Charles Proxy) can call these RPCs with arbitrary data.

**Fix:** Add `CHECK` constraints in SQL (e.g., `CHECK (p_calories >= 0 AND p_calories <= 50000)`) and validate the JSONB structure in the RPC body before inserting.

---

### 8. `recent_foods` Has No DELETE Policy — Data Grows Forever
**File:** [002_rls_and_roles.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/002_rls_and_roles.sql#L40-L44)

**Problem:** The `recent_foods` table only has SELECT, INSERT, and UPDATE grants. There is **no DELETE** permission or policy. Users can never remove stale recent foods, and the system never prunes them.

**Why it matters:** Over months of use, each user accumulates unbounded recent food entries. This becomes a performance problem when the app fetches them (currently limited to 10, but the table itself grows without limit).

**Fix:** Add `DELETE` grant + RLS policy. Also consider implementing automatic pruning (e.g., keep only the top 50 by `used_count` or `last_used_at`).

---

### 9. Edge Function Errors Return Status 200 With Error Body
**Files:** [scan-food/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/scan-food/index.ts#L270-L274), [log-meal/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-meal/index.ts#L116-L119), [log-exercise/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-exercise/index.ts#L223-L226)

**Problem:** All three edge functions catch errors and return `{ status: 200 }` with `{ error: "..." }` in the body. A comment even explains: *"Return 200 so the client SDK doesn't throw a generic error."*

**Why it matters:**
- Monitoring/alerting tools (Supabase logs, Sentry, Datadog) cannot distinguish errors from successes
- Client-side error handling becomes fragile — you must check both `response.error` and `data.error`
- HTTP semantics are violated — load balancers, CDNs, and retry logic all treat 200 as "success"

**Fix:** Return proper HTTP status codes (400, 401, 429, 500) and handle the Supabase client SDK's error behavior by catching `FunctionsHttpError` on the client side.

---

### 10. `daily_summaries` Can Drift From Actual Meal Totals
**File:** [014_atomic_meal_limit.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/014_atomic_meal_limit.sql)

**Problem:** The `daily_summaries` table is a **denormalised running total** maintained by incrementing/decrementing on meal insert/delete. There is no recalculation mechanism. If any operation partially fails (e.g., insert succeeds but summary update doesn't, or the `FOUND` flag check on line 88 is wrong), the summary silently drifts out of sync.

**Why it matters:** Users see incorrect calorie/macro totals for the day. In a fitness app, this directly undermines user trust. There's no self-healing mechanism.

**Fix:** Add a scheduled job or RPC function that recalculates `daily_summaries` from `meal_entries` (`SELECT SUM(calories)... GROUP BY date`). Run it periodically or on-demand. Alternatively, compute summaries as a database view.

---

## 🟠 MEDIUM — Performance & Scalability Bottlenecks

### 11. Home Screen Makes 5+ Serial Database Queries on Every Load
**File:** [index.tsx (Home)](file:///c:/SDProjects/macro-tracker/mobile/app/(tabs)/index.tsx#L81-L157)

**Problem:** `fetchDashboardData` makes 5 sequential `await` calls to Supabase:
1. `daily_summaries` (filtered by date)
2. `meal_entries` with `meal_food(*)` join (filtered by date)
3. `recent_foods` (top 10)
4. `exercises` (filtered by date)
5. `weight_logs` (filtered by date)

These are sequential — each waits for the previous to finish.

**Why it matters:** On a mobile network (3G/4G), each round trip can be 100-300ms. Five sequential queries = 500-1500ms of loading time. Users see a stale or blank screen while waiting.

**Fix:** 
- Use `Promise.all()` to run all 5 queries in parallel (they're independent)
- Or create a single server-side RPC that returns all dashboard data in one call
- Consider caching the response locally with SWR/React Query

---

### 12. No Database Indexes on Frequently Filtered Columns
**File:** [001_tables.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/001_tables.sql)

**Problem:** There are **no explicit indexes** on any table. Queries filter on:
- `meal_entries.user_id + created_at` (every home screen load)
- `daily_summaries.user_id + summary_date` (every home screen load)
- `exercises.user_id + exercise_date` (every home screen load)
- `weight_logs.user_id + recorded_at` (every home screen load + analytics)
- `recent_foods.user_id + last_used_at` (every home screen load)

The only index is the `UNIQUE(user_id, summary_date)` constraint on `daily_summaries`.

**Why it matters:** As data grows (1000+ users × 365 days × 3 meals/day = millions of rows), every query does a full table scan filtered by user_id. Performance degrades linearly with data volume.

**Fix:** Add composite indexes:
```sql
CREATE INDEX idx_meal_entries_user_date ON meal_entries(user_id, created_at);
CREATE INDEX idx_exercises_user_date ON exercises(user_id, exercise_date);
CREATE INDEX idx_weight_logs_user_date ON weight_logs(user_id, recorded_at);
CREATE INDEX idx_recent_foods_user_usage ON recent_foods(user_id, last_used_at DESC);
```

---

### 13. Analytics Screen Fetches 30 Days of Raw Data on Every Focus
**File:** [analytics.tsx](file:///c:/SDProjects/macro-tracker/mobile/app/(tabs)/analytics.tsx#L38-L81)

**Problem:** Every time the Analytics tab receives focus (`useFocusEffect`), it:
1. Fetches the user's profile
2. Fetches all daily summaries for the last 30 days
3. Fetches all weight logs for the last 30 days

This happens every single time the user switches to the Insights tab — even if they just looked at it 2 seconds ago.

**Why it matters:** Wasted bandwidth and database load. On a slow connection, the tab will flash blank/stale before re-rendering.

**Fix:** Cache with a staleness window (e.g., only refetch if data is >5 minutes old). Use React Query or a simple timestamp check. Only pull-to-refresh should force a full refetch.

---

### 14. `log-exercise` Fetches ALL Activity Types From DB on Every Call
**File:** [log-exercise/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-exercise/index.ts#L119-L128)

**Problem:** Every time a user logs an exercise, the edge function fetches the entire `activity_types` table (70+ rows) from the database, maps it into a string, and sends it as part of the Gemini prompt.

**Why it matters:** This is a static reference table that changes essentially never. You're paying for a database query and transferring ~3KB of constant data on every single exercise analysis call. At scale, this becomes hundreds of thousands of redundant queries per day.

**Fix:** Cache the activity types in-memory within the Edge Function (Deno's module-level variables persist across requests in the same isolate). Or move the activity list to a static constant.

---

### 15. Image Upload Sends Full Base64 Through Edge Functions
**Files:** [AddFoodModal.tsx](file:///c:/SDProjects/macro-tracker/mobile/components/AddFoodModal.tsx#L61-L76), [scan-food/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/scan-food/index.ts#L188-L195), [log-meal/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-meal/index.ts#L55-L80)

**Problem:** The image flow is:
1. Client compresses image to 1024px wide, 70% quality → base64
2. Base64 is sent to `scan-food` (for AI analysis) — **OK, necessary**
3. Base64 is sent *again* to `log-meal` (for storage upload) — **redundant double-transfer**

Base64 encoding inflates data by ~33%. A 500KB JPEG becomes ~670KB of JSON payload.

**Why it matters:** Double data transfer over mobile networks. The image is sent over the network twice. On slow connections, this significantly impacts the save time.

**Fix:** Upload the image directly from the client to Supabase Storage (the RLS policy already allows authenticated uploads), get back the path, then pass only the `image_path` string to `log-meal`.

---

### 16. Rate Limiting Shares the Same Bucket Across `scan-food` and `log-exercise`
**Files:** [scan-food/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/scan-food/index.ts#L128-L141), [log-exercise/index.ts](file:///c:/SDProjects/macro-tracker/supabase/functions/log-exercise/index.ts#L74-L87)

**Problem:** Both functions use the exact same Upstash rate limit prefixes: `ratelimit:minute` and `ratelimit:day`. This means scanning 3 meals consumes the per-minute budget for exercise logging too — and the daily limit of 6 is shared across both features.

**Why it matters:** A user who scans 6 meals in a day cannot log any exercises via AI, and vice versa. The features compete for the same quota.

**Fix:** Use distinct prefixes: `ratelimit:scan:minute`, `ratelimit:scan:day`, `ratelimit:exercise:minute`, `ratelimit:exercise:day`.

---

## 🔵 MEDIUM — Code Quality & Maintainability

### 17. Home Screen Component is a 967-Line God Component
**File:** [index.tsx](file:///c:/SDProjects/macro-tracker/mobile/app/(tabs)/index.tsx)

**Problem:** The home screen is a single 967-line file containing:
- 15+ state variables
- 8 data-fetching/mutation handler functions
- Profile initialization logic
- Health Connect sync logic
- Exercise calorie calculations
- Full UI rendering
- All styles

**Why it matters:** This is unmaintainable. Any change risks breaking unrelated features. Testing individual behaviors is impossible. New developers (or future you) will struggle to trace logic.

**Fix:** Extract into custom hooks:
- `useDashboardData(userId, date)` — all fetching
- `useHealthConnectSync(userId, profile)` — HC sync logic  
- `useMealActions(userId, date)` — CRUD for meals
- `useExerciseActions(userId, date)` — CRUD for exercises

---

### 18. Duplicated Supabase Client Files
**Files:** [mobile/lib/supabase.ts](file:///c:/SDProjects/macro-tracker/mobile/lib/supabase.ts), [mobile/src/lib/supabase.ts](file:///c:/SDProjects/macro-tracker/mobile/src/lib/supabase.ts)

**Problem:** Two identical `supabase.ts` files exist. Different components might import from different paths, potentially creating two separate Supabase client instances.

**Why it matters:** Two client instances means two separate auth state listeners, double the WebSocket connections, and potential session desynchronization.

**Fix:** Delete one and standardize all imports.

---

### 19. Duplicated Auth Logic
**Files:** [app/_layout.tsx](file:///c:/SDProjects/macro-tracker/mobile/app/_layout.tsx#L50-L68), [src/hooks/useAuth.ts](file:///c:/SDProjects/macro-tracker/mobile/src/hooks/useAuth.ts)

**Problem:** Auth session management (listen to `onAuthStateChange`, store session state) is implemented in both `_layout.tsx` and a `useAuth` hook. The `useAuth` hook doesn't appear to be used anywhere — the layout manages auth directly.

**Why it matters:** Confusing for maintainability. Future changes might be made to the wrong file.

**Fix:** Consolidate into one pattern — either use the hook everywhere or keep it in the layout. Delete the unused one.

---

### 20. Hardcoded AI Model Name in SQL Functions
**Files:** [014_atomic_meal_limit.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/014_atomic_meal_limit.sql#L62), [003_storage_and_functions.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/003_storage_and_functions.sql#L117)

**Problem:** `insert_meal_transaction` hardcodes `'google'` as `ai_provider` and `'gemini-3.5-flash'` as `ai_model`. But the actual model being used is `gemini-3.6-flash` (set in `user_ai_settings`). So every meal entry is logged with an incorrect model name.

**Why it matters:** Your audit trail / analytics for which AI model produced which result is wrong from day one.

**Fix:** Pass the actual model name from the Edge Function to the RPC, or remove the column if you're not using it for analytics.

---

### 21. `console.log` in Production Code
**Files:** [_layout.tsx](file:///c:/SDProjects/macro-tracker/mobile/app/_layout.tsx#L97-L99), [_layout.tsx](file:///c:/SDProjects/macro-tracker/mobile/app/_layout.tsx#L152-L153), many component files

**Problem:** Debug `console.log` statements (e.g., `console.log("--- SUPABASE REDIRECT URL ---")`, `console.log("useLocalSupabase:", ...)`) are present in production code.

**Why it matters:** In a Play Store release, console logs are visible to anyone running the app via ADB logcat. They may leak URLs, user IDs, or internal state. They also have a minor performance cost.

**Fix:** Remove all debug logs, or configure a logging library with environment-based log levels.

---

## 🟣 ARCHITECTURAL — Production Readiness Gaps

### 22. No Offline Support or Data Caching
**Problem:** Every screen requires a live network connection to function. There is no:
- Local SQLite/MMKV cache for previously-loaded data
- Optimistic UI beyond the single `handleDeleteEntry` case
- Queue for operations performed offline

**Why it matters:** Mobile users frequently lose connectivity (elevators, subways, poor coverage). The app becomes completely unusable without internet. A real production fitness app (MyFitnessPal, Cronometer) works offline.

**Fix:** Implement a local cache layer (e.g., WatermelonDB, or React Query with AsyncStorage persistence). Queue mutations and sync when back online.

---

### 23. No Error Boundaries or Global Error Handling
**Problem:** There is no React Error Boundary in the component tree. If any component throws during rendering, the entire app crashes with a white screen.

**Why it matters:** A single null-pointer exception in any component (e.g., `profile.target_calories` when profile is null) crashes the whole app. On a Play Store app, this generates 1-star reviews.

**Fix:** Add `ErrorBoundary` components wrapping each major section. Show a "Something went wrong, pull to retry" message instead of crashing.

---

### 24. No State Management Layer
**Problem:** All application state lives in `useState` hooks in individual components. There is no global state management (Context, Zustand, Redux, Jotai). Profile data, for example, is fetched separately in `index.tsx`, `settings.tsx`, and `analytics.tsx`.

**Why it matters:** 
- Same data fetched 3x from the database
- State can desync between screens (e.g., updating goals in settings doesn't reflect on home until manual refresh)
- No single source of truth for "current user profile"

**Fix:** Implement a lightweight global state solution (Zustand is the most common choice for React Native). Store profile, daily summary, and session data centrally.

---

### 25. No Automated Tests
**Problem:** There are zero test files in the entire project. No unit tests, no integration tests, no E2E tests.

**Why it matters:** Every code change is manually tested (or not tested at all). Regressions are caught by users, not CI. This is the #1 barrier to scaling development confidently.

**Fix:** Start with integration tests for the critical paths:
- Meal insert/delete/summary consistency
- Auth flow
- Edge Function response handling

---

### 26. No CI/CD Pipeline
**Problem:** There is no `.github/workflows/`, no `Dockerfile`, no deployment automation. Deployments are manual via CLI.

**Why it matters:** Manual deployments are error-prone. You can push broken code, forget to deploy Edge Functions, or run migrations out of order. For Play Store, you want automated builds, version bumping, and changelog generation.

**Fix:** Set up GitHub Actions (or similar) for:
- Lint + type-check on PR
- Supabase migration dry-run
- EAS Build for APK/AAB generation

---

### 27. No Structured Logging or Monitoring
**Problem:** The only logging is `console.log` / `console.error`. There is no:
- Crash reporting (Sentry, Bugsnag)
- Analytics (usage patterns, feature engagement)
- Server-side request logging with correlation IDs
- Alerting for errors or quota exhaustion

**Why it matters:** In production, you're flying blind. You won't know if the AI service is down, if rate limits are too aggressive, or if users are experiencing errors — until they email you or leave bad reviews.

**Fix:** Integrate Sentry for crash reporting and a basic analytics provider (PostHog, Mixpanel) for usage metrics. Add structured logging with request IDs in Edge Functions.

---

### 28. No Database Backup Strategy
**Problem:** There is no mention of database backups, point-in-time recovery configuration, or data export capabilities.

**Why it matters:** Supabase provides daily backups on paid plans, but:
- On the free plan, there are no backups
- There's no user-facing "export my data" feature (required by GDPR/Play Store)

**Fix:** Ensure you're on a Supabase plan with backups enabled. Consider a nightly `pg_dump` cron as a secondary measure. Add a "Download my data" option in settings for compliance.

---

### 29. No Rate Limiting on Direct DB Operations (Only on AI)
**Problem:** Rate limiting only exists on the AI-powered edge functions (`scan-food`, `log-exercise`). Direct database operations (insert meals manually, update profile, log weight) have **no rate limits**.

**Why it matters:** An attacker with a valid session token can:
- Insert millions of meal entries via `insert_meal_transaction` RPC
- Flood `weight_logs` with garbage data
- DoS the database

**Fix:** Add Supabase's built-in request rate limiting (available via `config.toml`), or add application-level throttling for write operations.

---

### 30. Timezone Handling is Inconsistent
**Files:** [014_atomic_meal_limit.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/014_atomic_meal_limit.sql#L35), [index.tsx](file:///c:/SDProjects/macro-tracker/mobile/app/(tabs)/index.tsx#L67), [003_storage_and_functions.sql](file:///c:/SDProjects/macro-tracker/supabase/migrations/003_storage_and_functions.sql#L43)

**Problem:** The app inconsistently handles timezones:
- RPC uses `(now() AT TIME ZONE 'UTC')::date` for "today"
- Client uses `new Date().toISOString().split('T')[0]` for "today" — which gives UTC date
- But meal queries filter by `created_at >= '${dateStr}T00:00:00.000Z'` — UTC midnight
- A user in IST (UTC+5:30) logging a meal at 11pm local time gets it assigned to the next UTC day

**Why it matters:** Users in non-UTC timezones will see meals appear under the wrong day, daily summaries won't match what they actually ate "today", and the 5-meal-per-type-per-day limit may be bypassed or trigger incorrectly.

**Fix:** Store the user's timezone in their profile. Use it consistently in both the RPC functions and client-side date calculations. Consider using `date_trunc('day', created_at AT TIME ZONE user_timezone)` in queries.

---

## Summary Table

| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 1 | API keys stored as plaintext | 🔴 Critical | Security |
| 2 | SECURITY DEFINER privilege escalation risk | 🔴 Critical | Security |
| 3 | JWT verification disabled on Edge Functions | 🔴 Critical | Security |
| 4 | CORS allows all origins | 🔴 Critical | Security |
| 5 | Meal images publicly readable | 🔴 Critical | Privacy |
| 6 | Supabase temp files in git | 🔴 Critical | Security |
| 7 | No input validation on RPC parameters | 🟡 High | Data Integrity |
| 8 | `recent_foods` has no DELETE — unbounded growth | 🟡 High | Data Access |
| 9 | Errors return HTTP 200 | 🟡 High | Reliability |
| 10 | Daily summaries can drift from reality | 🟡 High | Data Integrity |
| 11 | 5 serial DB queries on home screen load | 🟠 Medium | Performance |
| 12 | No database indexes | 🟠 Medium | Scalability |
| 13 | Analytics refetches on every tab focus | 🟠 Medium | Performance |
| 14 | Activity types fetched from DB every call | 🟠 Medium | Performance |
| 15 | Image uploaded twice (scan + log) | 🟠 Medium | Performance |
| 16 | Shared rate limit bucket across features | 🟠 Medium | Reliability |
| 17 | 967-line god component | 🔵 Medium | Maintainability |
| 18 | Duplicated Supabase client | 🔵 Medium | Maintainability |
| 19 | Duplicated auth logic | 🔵 Medium | Maintainability |
| 20 | Hardcoded wrong AI model name in SQL | 🔵 Medium | Data Integrity |
| 21 | console.log in production | 🔵 Medium | Security/Perf |
| 22 | No offline support | 🟣 Architectural | Production Readiness |
| 23 | No error boundaries | 🟣 Architectural | Production Readiness |
| 24 | No state management | 🟣 Architectural | Production Readiness |
| 25 | No automated tests | 🟣 Architectural | Production Readiness |
| 26 | No CI/CD pipeline | 🟣 Architectural | Production Readiness |
| 27 | No logging/monitoring/crash reporting | 🟣 Architectural | Production Readiness |
| 28 | No backup strategy or data export | 🟣 Architectural | Compliance |
| 29 | No rate limiting on direct DB writes | 🟣 Architectural | Scalability |
| 30 | Inconsistent timezone handling | 🟣 Architectural | Data Integrity |

---

## Recommended Priority Order

1. **Fix #6** — Remove `.temp/` from git (5 minutes)
2. **Fix #3** — Enable `verify_jwt = true` (2 minutes)
3. **Fix #5** — Make meal images bucket private (15 minutes)
4. **Fix #4** — Remove wildcard CORS (5 minutes)
5. **Fix #1** — Encrypt API keys at rest (1 hour)
6. **Fix #7** — Add input validation to RPCs (30 minutes)
7. **Fix #12** — Add database indexes (15 minutes)
8. **Fix #11** — Parallelize home screen queries (30 minutes)
9. **Fix #16** — Separate rate limit buckets (10 minutes)
10. **Fix #30** — Fix timezone handling (2 hours)

The remaining items should be tackled as part of a broader production-readiness sprint before Play Store release.
