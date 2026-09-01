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
  prefix: "ratelimit:global:scan-food"
}) : null;

const edgeBurstLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(edgeBurstLimit, "1 m"),
  ephemeralCache: edgeBurstCacheMap,
  prefix: "ratelimit:burst:scan-food"
}) : null;

const edgeDailyLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(edgeDailyLimit, "1 d"),
  ephemeralCache: edgeDailyCacheMap,
  prefix: "ratelimit:edge:scan-food:day"
}) : null;

const aiMinuteLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(aiLimitMinute, "1 m"),
  ephemeralCache: aiMinuteCacheMap,
  prefix: "ratelimit:ai:scan-food:minute"
}) : null;

const aiDayLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(aiLimitDay, "1 d"),
  ephemeralCache: aiDailyCacheMap,
  prefix: "ratelimit:ai:scan-food:day"
}) : null;

const geminiBreaker = new CircuitBreaker({
  serviceName: 'gemini:scan-food',
  failureThreshold: 3,
  cooldownPeriodSeconds: 30,
  redis,
});


const geminiPrompt = `
Analyze the provided meal from the user's text and/or image.

Identify:
- The food items
- Estimated quantity of each food
- Total nutritional values for the meal
- A short, simple, 2-4 word title for the meal in the 'title' field (e.g., 'Chicken Salad' or 'Breakfast Bowl')

Nutrition values must be numeric and represent the entire meal.
If the exact quantity is unclear, make a reasonable estimate.
Do not invent foods that are not reasonably identifiable from the input.
For confidence, provide a value between 0 and 1.
`;

const macroSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    meal_name: { type: "string" },
    foods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          calories: { type: "integer" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" }
        },
        required: ["name", "quantity", "unit", "calories", "protein_g", "carbs_g", "fat_g"]
      }
    },
    totals: {
      type: "object",
      properties: {
        calories: { type: "integer" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" }
      },
      required: ["calories", "protein_g", "carbs_g", "fat_g"]
    },
    confidence: { type: "number" }
  },
  required: ["title", "meal_name", "foods", "totals", "confidence"]
};

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
        JSON.stringify({ error: "Request payload is too large (maximum 3MB). Please choose a smaller image." }),
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
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    tAuth = Math.round(performance.now() - tAuthStart);

    // ── 3. Parse & Validate Payload Early (Supports Multipart & JSON) ─
    const tParseStart = performance.now();
    const contentType = req.headers.get("content-type") || "";
    let text: string | undefined;
    let image_base64: string | undefined;
    let idempotencyId: string | null = req.headers.get('x-idempotency-key');

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      text = (formData.get("text") as string) || undefined;
      idempotencyId = idempotencyId || (formData.get("idempotency_key") as string) || null;
      const imageFile = formData.get("image") as File | null;
      if (imageFile) {
        const arrayBuffer = await imageFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binaryStr = "";
        const len = bytes.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
          binaryStr += String.fromCharCode.apply(null, chunk as any);
        }
        image_base64 = btoa(binaryStr);
      }
    } else {
      const body = await req.json();
      text = body.text;
      image_base64 = body.image_base64;
      idempotencyId = idempotencyId || body.idempotency_key || null;
    }

    if (!text && !image_base64) {
      return new Response(
        JSON.stringify({ error: 'Must provide either text, image, or both' }),
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
        const cached = await redis.get(`idempotent:scan-food:${user.id}:${idempotencyId}`);
        if (cached) {
          tCache = Math.round(performance.now() - tCacheStart);
          const tTotal = Math.round(performance.now() - t0);
          console.log(`[scan-food] [CACHE HIT] key: ${idempotencyId} | total: ${tTotal}ms`);
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
        console.warn("scan-food: Idempotency cache lookup failed:", cacheErr);
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
          const retryAfter = Math.ceil((burstRes.reset - Date.now()) / 1000);
          return new Response(
            JSON.stringify({ 
              error: `Too many requests. Please wait ${retryAfter}s before scanning again.`,
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
              error: `Daily scan limit reached. Resets in ${hours} hour${hours > 1 ? 's' : ''}.`,
              retry_after_seconds: retryAfter,
              rate_limited: true,
              is_daily_limit: true
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
          );
        }
      } catch (burstErr) {
        console.warn("scan-food: Edge rate limiter failed open:", burstErr);
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
    tDb = Math.round(performance.now() - tDbStart);

    // ── 7. AI Specific Rate Limiting (Parallel 3/min & 6/day for Free Tier)
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
              error: `You've reached your free daily limit of 6 meal scans. Resets in ${hours} hour${hours > 1 ? 's' : ''}, or add your own API key in Settings for unlimited scans.`,
              retry_after_seconds: retryAfter,
              rate_limited: true,
              is_daily_limit: true
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
          );
        }
      } catch (aiRateErr) {
        console.warn("scan-food: AI rate limiter failed open:", aiRateErr);
      }
    }
    tRateLimit = Math.round(performance.now() - tRateLimitStart);

    // ── 8. Build Gemini Request ───────────────────────────────────────
    const apiKey = customApiKey || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const parts: any[] = [{ text: geminiPrompt }];

    if (text) {
      parts.push({ text: `User description: ${text}` });
    }

    if (image_base64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: image_base64,
        },
      });
    }

    console.log(`scan-food: Calling Gemini (${aiModel}) for user`, user.id);

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
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: macroSchema,
            thinkingConfig: {
              thinkingLevel: "MINIMAL",
            },
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
      console.error("Gemini raw text:", geminiText);
      await geminiBreaker.recordFailure(502, "Invalid JSON in response");
      throw new Error("Gemini response was not valid JSON");
    }
    tGemini = Math.round(performance.now() - tGeminiStart);

    // Call succeeded -> reset circuit breaker
    await geminiBreaker.recordSuccess();

    // ── 10. Cache for Idempotency (10 minute TTL) ─────────────────────
    if (idempotencyId && redis) {
      try {
        await redis.set(
          `idempotent:scan-food:${user.id}:${idempotencyId}`,
          JSON.stringify(parsedResponse),
          { ex: 600 }
        );
      } catch (cacheSetErr) {
        console.warn("scan-food: Failed to cache idempotency response:", cacheSetErr);
      }
    }

    const tTotal = Math.round(performance.now() - t0);
    const serverTiming = `auth;dur=${tAuth}, parse;dur=${tParse}, cache;dur=${tCache}, ratelimit;dur=${tRateLimit}, db;dur=${tDb}, gemini;dur=${tGemini}, total;dur=${tTotal}`;
    
    console.log(`[scan-food] [TIMING] Total: ${tTotal}ms | Gemini: ${tGemini}ms (${((tGemini/tTotal)*100).toFixed(1)}%) | Upload/Parse: ${tParse}ms | DB: ${tDb}ms | Redis: ${tRateLimit}ms | Auth: ${tAuth}ms`);

    // ── 11. Return Estimate ───────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        data: parsedResponse,
        timings: {
          total_ms: tTotal,
          gemini_ms: tGemini,
          upload_parse_ms: tParse,
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
    console.error("scan-food error:", error);
    
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
