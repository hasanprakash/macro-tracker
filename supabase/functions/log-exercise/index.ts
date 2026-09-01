import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.3";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";
import { CircuitBreaker } from "../_shared/circuitBreaker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Expose-Headers': 'Server-Timing, X-Cache, Retry-After',
};

// ── Module-Scoped Singleton Clients & Persistent Ephemeral Caches ─────
// Keeping these outside Deno.serve reuses TCP connections and enables 0ms in-memory cache hits
const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
const redis = (redisUrl && redisToken) ? new Redis({ url: redisUrl, token: redisToken }) : null;

const globalCacheMap = new Map();
const edgeBurstCacheMap = new Map();
const edgeDailyCacheMap = new Map();
const aiMinuteCacheMap = new Map();
const aiDailyCacheMap = new Map();

const globalLimit = parseInt(Deno.env.get('GLOBAL_LIMIT_PER_MINUTE') || '100', 10);
const edgeBurstLimit = parseInt(Deno.env.get('EDGE_LIMIT_PER_MINUTE') || '5', 10);
const edgeDailyLimit = parseInt(Deno.env.get('EDGE_LIMIT_PER_DAY') || '15', 10);
const aiLimitMinute = parseInt(Deno.env.get('AI_LIMIT_PER_MINUTE') || '3', 10);
const aiLimitDay = parseInt(Deno.env.get('AI_LIMIT_PER_DAY') || '6', 10);

const globalLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(globalLimit, "1 m"),
  ephemeralCache: globalCacheMap,
  prefix: "ratelimit:global:log-exercise"
}) : null;

const edgeBurstLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(edgeBurstLimit, "1 m"),
  ephemeralCache: edgeBurstCacheMap,
  prefix: "ratelimit:burst:log-exercise"
}) : null;

const edgeDailyLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(edgeDailyLimit, "1 d"),
  ephemeralCache: edgeDailyCacheMap,
  prefix: "ratelimit:edge:log-exercise:day"
}) : null;

const aiMinuteLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(aiLimitMinute, "1 m"),
  ephemeralCache: aiMinuteCacheMap,
  prefix: "ratelimit:ai:exercise:minute"
}) : null;

const aiDayLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(aiLimitDay, "1 d"),
  ephemeralCache: aiDailyCacheMap,
  prefix: "ratelimit:ai:exercise:day"
}) : null;

const geminiBreaker = new CircuitBreaker({
  serviceName: 'gemini:log-exercise',
  failureThreshold: 3,
  cooldownPeriodSeconds: 30,
  redis,
});


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const t0 = performance.now();
  let tAuth = 0;
  let tParse = 0;
  let tCache = 0;
  let tRateLimit = 0;
  let tDb = 0;
  let tGemini = 0;

  try {
    // ── 1. Early Request Size Check (Max 3MB) ────────────────────────
    const contentLength = req.headers.get("content-length");
    const maxSizeBytes = parseInt(Deno.env.get("MAX_REQUEST_SIZE_BYTES") || "3145728", 10);
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      return new Response(
        JSON.stringify({ error: "Request payload is too large (maximum 3MB). Please reduce input size." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Authentication ─────────────────────────────────────────────
    const tAuthStart = performance.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const accessToken = authorization.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    tAuth = Math.round(performance.now() - tAuthStart);

    // ── 3. Parse & Validate Input Early ───────────────────────────────
    const tParseStart = performance.now();
    const body = await req.json();
    const { text, weight = 70, idempotency_key } = body;
    const idempotencyId = req.headers.get('x-idempotency-key') || idempotency_key || null;

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Must provide text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    tParse = Math.round(performance.now() - tParseStart);

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown-ip';
    const identifier = `${user.id}:${ip}`;

    // ── 4. Idempotency Fast-Path Cache Check (Redis Lookup) ───────────
    const tCacheStart = performance.now();
    if (idempotencyId && redis) {
      try {
        const cached = await redis.get(`idempotent:log-exercise:${user.id}:${idempotencyId}`);
        if (cached) {
          tCache = Math.round(performance.now() - tCacheStart);
          const tTotal = Math.round(performance.now() - t0);
          console.log(`[log-exercise] [CACHE HIT] key: ${idempotencyId} | total: ${tTotal}ms`);
          const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return new Response(
            JSON.stringify({ success: true, data: cachedData, cached: true, timings: { total_ms: tTotal, cache_ms: tCache } }),
            { 
              status: 200, 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json', 
                'X-Cache': 'HIT',
                'Server-Timing': `cache;dur=${tCache}, total;dur=${tTotal}`
              } 
            }
          );
        }
      } catch (cacheErr) {
        console.warn("log-exercise: Idempotency cache lookup failed:", cacheErr);
      }
    }
    tCache = Math.round(performance.now() - tCacheStart);

    // ── 5. Parallel Global & Edge Function Rate Limiting (Promise.all) ─
    const tRateLimitStart = performance.now();
    if (globalLimiter && edgeBurstLimiter && edgeDailyLimiter) {
      try {
        const [globalRes, burstRes, edgeDailyRes] = await Promise.all([
          globalLimiter.limit("global"),
          edgeBurstLimiter.limit(identifier),
          edgeDailyLimiter.limit(identifier),
        ]);

        if (!globalRes.success) {
          const retryAfter = Math.ceil((globalRes.reset - Date.now()) / 1000);
          return new Response(
            JSON.stringify({ 
              error: "High server load. Please wait a moment before trying again.",
              retry_after_seconds: retryAfter,
              rate_limited: true
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
          );
        }

        if (!burstRes.success) {
          const retryAfter = Math.ceil((burstReset - Date.now()) / 1000);
          return new Response(
            JSON.stringify({ 
              error: `Too many requests. Please wait ${retryAfter}s before analyzing exercise again.`,
              retry_after_seconds: retryAfter,
              rate_limited: true
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
          );
        }

        if (!edgeDailyRes.success) {
          const retryAfter = Math.ceil((edgeDailyRes.reset - Date.now()) / 1000);
          const hours = Math.ceil(retryAfter / 3600);
          return new Response(
            JSON.stringify({ 
              error: `Daily exercise scan limit reached. Resets in ${hours} hour${hours > 1 ? 's' : ''}.`,
              retry_after_seconds: retryAfter,
              rate_limited: true,
              is_daily_limit: true
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
          );
        }
      } catch (burstErr) {
        console.warn("log-exercise: Edge rate limiter failed open:", burstErr);
      }
    }

    // ── 6. Fetch User's Assigned AI Model & Custom API Key ───────────
    const tDbStart = performance.now();
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    let aiModel = 'gemini-3.6-flash'; // Safe fallback
    let customApiKey = null;
    const { data: modelData } = await supabaseAdmin
      .from('user_ai_settings')
      .select('ai_model, custom_api_key')
      .eq('user_id', user.id)
      .single();
      
    if (modelData?.ai_model) {
      aiModel = modelData.ai_model;
    }
    if (modelData?.custom_api_key) {
      customApiKey = modelData.custom_api_key;
    }

    // ── 7. Load Activity Types ────────────────────────────────────────
    const { data: activities, error: actError } = await supabase
      .from('activity_types')
      .select('code, name, met')
      .eq('is_active', true);

    if (actError || !activities || activities.length === 0) {
      throw new Error('Failed to load activity types');
    }
    tDb = Math.round(performance.now() - tDbStart);

    // ── 8. AI Specific Rate Limiting (Parallel 3/min & 6/day for Free Tier)
    if (!customApiKey && aiMinuteLimiter && aiDayLimiter) {
      try {
        const [minuteRes, dayRes] = await Promise.all([
          aiMinuteLimiter.limit(identifier),
          aiDayLimiter.limit(identifier),
        ]);

        if (!minuteRes.success) {
          const retryAfter = Math.ceil((minuteRes.reset - Date.now()) / 1000);
          return new Response(
            JSON.stringify({ 
              error: `AI analysis limit reached (3 per minute). Please wait ${retryAfter}s before trying again.`,
              retry_after_seconds: retryAfter,
              rate_limited: true
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
          );
        }

        if (!dayRes.success) {
          const retryAfter = Math.ceil((dayRes.reset - Date.now()) / 1000);
          const hours = Math.ceil(retryAfter / 3600);
          return new Response(
            JSON.stringify({ 
              error: `You've reached your free daily limit of 6 exercise scans. Resets in ${hours} hour${hours > 1 ? 's' : ''}, or add your own API key in Settings for unlimited scans.`,
              retry_after_seconds: retryAfter,
              rate_limited: true,
              is_daily_limit: true
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
          );
        }
      } catch (aiRateErr) {
        console.warn("log-exercise: AI rate limiter failed open:", aiRateErr);
      }
    }
    tRateLimit = Math.round(performance.now() - tRateLimitStart);

    const activityList = activities.map(a => `- ${a.name} (Code: ${a.code})`).join('\n');

    const geminiPrompt = `
Extract the exercise activity code and duration in minutes from the user's description.
The activity_code MUST be one of the following codes:
${activityList}

If the user's exercise does not perfectly match, pick the closest one based on the name.
Also, generate a short, simple, 2-4 word title for the exercise in the 'title' field (e.g., 'Morning Run' or 'Gym Session').
Return ONLY a JSON object with 'title' (string), 'activity_code' (string) and 'duration_minutes' (number).
`;

    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        activity_code: { type: "string" },
        duration_minutes: { type: "number" }
      },
      required: ["title", "activity_code", "duration_minutes"]
    };

    const apiKey = customApiKey || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    // ── 9. Circuit Breaker Check ──────────────────────────────────────
    const circuitStatus = await geminiBreaker.check();
    if (!circuitStatus.allowed && circuitStatus.errorResponse) {
      return new Response(
        JSON.stringify(circuitStatus.errorResponse),
        { 
          status: 503, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json", 
            "Retry-After": circuitStatus.errorResponse.retry_after_seconds.toString() 
          } 
        }
      );
    }

    // ── 10. Call Gemini API ───────────────────────────────────────────
    const tGeminiStart = performance.now();
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent`;

    let response;
    try {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: geminiPrompt }, { text: `User description: ${text}` }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: { thinkingLevel: "MINIMAL" }
          }
        }),
      });
    } catch (fetchErr: any) {
      await geminiBreaker.recordFailure(503, fetchErr.message);
      throw new Error(`AI service connection error: ${fetchErr.message}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      let niceError = "AI service error";
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          niceError = parsed.error.message;
        }
      } catch (e) {
        niceError = errText;
      }
      await geminiBreaker.recordFailure(response.status, niceError);
      throw new Error(niceError);
    }

    const geminiData = await response.json();
    const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!geminiText) {
      await geminiBreaker.recordFailure(502, "Empty candidates response");
      throw new Error("Failed to parse Gemini response text");
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(geminiText);
    } catch (_e) {
      await geminiBreaker.recordFailure(502, "Invalid JSON in response");
      throw new Error("Gemini response was not valid JSON");
    }
    tGemini = Math.round(performance.now() - tGeminiStart);

    // Call succeeded -> reset circuit breaker
    await geminiBreaker.recordSuccess();

    const matchedActivity = activities.find(a => a.code === parsedResponse.activity_code) || activities[0];
    const duration = parsedResponse.duration_minutes || 0;
    const met = matchedActivity.met || 5.0;
    const caloriesBurned = duration * (((met - 1) * 3.5 * weight) / 200);

    const finalResult = {
      title: parsedResponse.title || matchedActivity.name,
      exercise_type: matchedActivity.name,
      activity_code: matchedActivity.code,
      duration_minutes: duration,
      calories_burned: caloriesBurned,
      source: 'gemini',
      calculation_method: 'met'
    };

    // ── 10. Cache for Idempotency (10 minute TTL) ─────────────────────
    if (idempotencyId && redis) {
      try {
        await redis.set(
          `idempotent:log-exercise:${user.id}:${idempotencyId}`,
          JSON.stringify(finalResult),
          { ex: 600 }
        );
      } catch (cacheSetErr) {
        console.warn("log-exercise: Failed to cache idempotency response:", cacheSetErr);
      }
    }

    const tTotal = Math.round(performance.now() - t0);
    const serverTiming = `auth;dur=${tAuth}, parse;dur=${tParse}, cache;dur=${tCache}, ratelimit;dur=${tRateLimit}, db;dur=${tDb}, gemini;dur=${tGemini}, total;dur=${tTotal}`;

    console.log(`[log-exercise] [TIMING] Total: ${tTotal}ms | Gemini: ${tGemini}ms (${((tGemini/tTotal)*100).toFixed(1)}%) | DB: ${tDb}ms | Redis: ${tRateLimit}ms | Auth: ${tAuth}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: finalResult,
        timings: {
          total_ms: tTotal,
          gemini_ms: tGemini,
          db_ms: tDb,
          redis_ms: tRateLimit,
          auth_ms: tAuth,
        }
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Server-Timing': serverTiming,
        } 
      }
    );
  } catch (error: any) {
    console.error("log-exercise error:", error);

    let friendlyMessage = error.message || "An unexpected error occurred.";
    if (friendlyMessage.includes('high demand') || friendlyMessage.includes('503') || friendlyMessage.includes('overloaded')) {
      friendlyMessage = "Our AI is currently experiencing high demand. Please try again in a moment.";
    }

    return new Response(
      JSON.stringify({ error: friendlyMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
