# Rate Limiting & Security Implementation Plan (Final)

Excellent feedback. Your optimizations and specific rules make the architecture much more robust and efficient. Here is the finalized plan reflecting your explicit instructions:

## 1. Upstash Redis (API Rate Limiting)
To prevent database overload and Sybil attacks, we will use Upstash Redis in the Edge Functions with a multi-factor key approach.
- **Key Strategy:** We will use `ratelimit:${userId}:${ipAddress}` or similar composite keys.
- **Rules (Checked BEFORE calling Gemini):**
  - **Short-Term Abuse:** Maximum **3 AI requests per minute**.
  - **Daily Quota:** Maximum **6 AI requests per day** per user.
- If the limit is hit, the Edge Function immediately returns a `429` status, terminating execution *before* hitting Gemini.

## 2. Max 5 Entries Per Meal (Atomic DB Enforcement)
To enforce a strict limit of 5 entries per meal type (e.g., 5 breakfast entries per day) and avoid race conditions, we will update the existing `insert_meal_transaction` PostgreSQL RPC.
- **Atomic Locking:** We will lock the user's `daily_summaries` row for the day using `FOR UPDATE`. This forces any simultaneous requests to queue up sequentially.
- **The Check:** Once the lock is acquired, we `SELECT COUNT(*)` for that meal type. If `count >= 5`, the RPC aborts and throws an error *before* inserting.
- **Why this is bulletproof:** As you noted, checking `SELECT COUNT(*)` without a lock allows two simultaneous requests to see `count = 4` and both insert. Row-level locking prevents this entirely.

## 3. Frontend Optimization (Pre-emptive Blocking)
To save unnecessary Gemini API calls and provide a better UX, we won't wait for the Edge Function or Database to reject a 6th meal entry.
- **Client-Side Check:** Since the app already holds `todaysEntries` in memory, we will simply check `todaysEntries.filter(e => e.meal_type === activeMealType).length >= 5`.
- **Action:** If the limit is reached, we will **disable the camera/text input UI** for that specific meal type and show a message: *"You have reached the maximum of 5 entries for [Meal]."*
- This completely stops the user at the UI level, acting as our first line of defense before the DB enforces it as the final line of defense.

## Open Questions

> [!IMPORTANT]
> Since we are aligned on the architecture, there's just one setup step left. I need you to create a free Upstash Redis database so we can implement the edge functions.
> 
> **Action Required:**
> 1. Go to [Upstash](https://upstash.com/) and create a free Redis database.
> 2. Get your `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
> 3. Add them to your `supabase/functions/.env` file.
> 
> Are you ready for me to begin writing the code (the atomic RPC update and the React Native UI checks) while you grab those credentials?
