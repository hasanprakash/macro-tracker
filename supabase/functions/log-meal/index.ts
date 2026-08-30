import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.3";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Expose-Headers': 'Server-Timing, Retry-After',
};

// ── Module-Scoped Singleton Clients & Persistent Ephemeral Caches ─────
// Keeping these outside Deno.serve reuses TCP connections and enables 0ms in-memory cache hits
const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
const redis = (redisUrl && redisToken) ? new Redis({ url: redisUrl, token: redisToken }) : null;

const globalCacheMap = new Map();
const burstCacheMap = new Map();
const dailyCacheMap = new Map();

const globalLimit = parseInt(Deno.env.get('GLOBAL_LIMIT_PER_MINUTE') || '100', 10);
const burstLimit = parseInt(Deno.env.get('LOG_MEAL_LIMIT_PER_MINUTE') || '10', 10);
const dailyLimit = parseInt(Deno.env.get('LOG_MEAL_LIMIT_PER_DAY') || '30', 10);

const globalLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(globalLimit, "1 m"),
  ephemeralCache: globalCacheMap,
  prefix: "ratelimit:global:log-meal"
}) : null;

const burstLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(burstLimit, "1 m"),
  ephemeralCache: burstCacheMap,
  prefix: "ratelimit:burst:log-meal"
}) : null;

const dailyLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(dailyLimit, "1 d"),
  ephemeralCache: dailyCacheMap,
  prefix: "ratelimit:daily:log-meal"
}) : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const t0 = performance.now();
  let tAuth = 0;
  let tParse = 0;
  let tRateLimit = 0;
  let tStorage = 0;
  let tDb = 0;

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

    // ── 3. High-Performance Parallel Rate Limiting (Promise.all) ─────
    const tRateLimitStart = performance.now();
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown-ip';
    const identifier = `${user.id}:${ip}`;

    if (globalLimiter && burstLimiter && dailyLimiter) {
      try {
        // Execute all 3 limit checks in parallel over a single round-trip
        const [globalRes, burstRes, dailyRes] = await Promise.all([
          globalLimiter.limit("global"),
          burstLimiter.limit(identifier),
          dailyLimiter.limit(identifier),
        ]);

        if (!globalRes.success) {
          const retryAfter = Math.ceil((globalRes.reset - Date.now()) / 1000);
          return new Response(
            JSON.stringify({ 
              error: "High server load. Please wait a moment before saving again.",
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
              error: `Too many meal save requests. Please wait ${retryAfter}s before saving again.`,
              retry_after_seconds: retryAfter,
              rate_limited: true
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
          );
        }

        if (!dailyRes.success) {
          const retryAfter = Math.ceil((dailyRes.reset - Date.now()) / 1000);
          const hours = Math.ceil(retryAfter / 3600);
          return new Response(
            JSON.stringify({ 
              error: `You have reached the daily limit of 30 meal logs. Resets in ${hours} hour${hours > 1 ? 's' : ''}.`,
              retry_after_seconds: retryAfter,
              rate_limited: true,
              is_daily_limit: true
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
          );
        }
      } catch (err) {
        console.warn("log-meal: Rate limiter failed open:", err);
      }
    }
    tRateLimit = Math.round(performance.now() - tRateLimitStart);

    // ── 4. Validate Payload & Filter Zero-Calorie Items ─────────────
    const tParseStart = performance.now();
    const body = await req.json();
    const { meal_type, meal_name, title, foods, totals, image_base64, meal_id, idempotency_key } = body;
    const clientMealId = meal_id || idempotency_key || null;

    const validFoods = Array.isArray(foods)
      ? foods.filter((f: any) => (Number(f.calories) || 0) > 0 && (Number(f.quantity) || 0) > 0)
      : [];

    const totalCals = Number(totals?.calories) || validFoods.reduce((s: number, f: any) => s + (Number(f.calories) || 0), 0);
    const totalProtein = Number(totals?.protein_g) || validFoods.reduce((s: number, f: any) => s + (Number(f.protein_g) || 0), 0);
    const totalCarbs = Number(totals?.carbs_g) || validFoods.reduce((s: number, f: any) => s + (Number(f.carbs_g) || 0), 0);
    const totalFat = Number(totals?.fat_g) || validFoods.reduce((s: number, f: any) => s + (Number(f.fat_g) || 0), 0);

    if (!meal_type || !meal_name || validFoods.length === 0 || totalCals <= 0) {
      return new Response(
        JSON.stringify({ error: 'Cannot log a meal with 0 calories or empty food items.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    tParse = Math.round(performance.now() - tParseStart);

    // ── 5. Upload Image (if provided) ─────────────────────────────────
    let imagePath = null;

    if (image_base64) {
      const tStorageStart = performance.now();
      try {
        const binaryStr = atob(image_base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const fileName = `${user.id}/${clientMealId || Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meal-images')
          .upload(fileName, bytes.buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error("Failed to upload image:", uploadError);
        } else {
          imagePath = uploadData.path;
        }
      } catch (imgErr) {
        console.error("Image upload failed:", imgErr);
        // Continue without image — not a blocking error
      }
      tStorage = Math.round(performance.now() - tStorageStart);
    }

    // ── 6. Execute Idempotent Database Transaction ────────────────────
    const tDbStart = performance.now();
    const { data: rpcData, error: rpcError } = await supabase.rpc('insert_meal_transaction', {
      p_meal_type: meal_type,
      p_meal_name: meal_name,
      p_calories: totalCals,
      p_protein: totalProtein,
      p_carbs: totalCarbs,
      p_fat: totalFat,
      p_image_path: imagePath,
      p_raw_input: { foods: validFoods },
      p_ai_response_json: { meal_name, title, foods: validFoods, totals: { calories: totalCals, protein_g: totalProtein, carbs_g: totalCarbs, fat_g: totalFat } },
      p_foods: validFoods,
      p_title: title,
      p_meal_id: clientMealId
    });

    if (rpcError) {
      console.error("DB RPC Error (insert_meal_transaction):", rpcError);
      throw new Error(rpcError.message || "Failed to save meal entry completely");
    }
    tDb = Math.round(performance.now() - tDbStart);

    const entryData = rpcData.entry;
    const isReplay = rpcData.idempotent_replay || false;

    const tTotal = Math.round(performance.now() - t0);
    const serverTiming = `auth;dur=${tAuth}, parse;dur=${tParse}, ratelimit;dur=${tRateLimit}, storage;dur=${tStorage}, db;dur=${tDb}, total;dur=${tTotal}`;

    console.log(`[log-meal] [TIMING] Total: ${tTotal}ms | DB: ${tDb}ms | Storage: ${tStorage}ms | Redis: ${tRateLimit}ms | Auth: ${tAuth}ms (Replay? ${isReplay})`);

    // ── 7. Return ─────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        entry: entryData,
        idempotent_replay: isReplay,
        timings: {
          total_ms: tTotal,
          db_ms: tDb,
          storage_ms: tStorage,
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
    console.error("log-meal error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred while saving the meal." }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
