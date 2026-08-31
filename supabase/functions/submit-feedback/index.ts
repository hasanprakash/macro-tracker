import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.3";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Expose-Headers': 'Server-Timing, Retry-After',
};

// ── Module-Scoped Singleton Clients & Persistent Ephemeral Caches ─────
const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
const redis = (redisUrl && redisToken) ? new Redis({ url: redisUrl, token: redisToken }) : null;

const globalCacheMap = new Map();
const userDailyCacheMap = new Map();

const userDailyLimit = parseInt(Deno.env.get('FEEDBACK_LIMIT_PER_DAY') || '10', 10);
const globalDailyLimit = parseInt(Deno.env.get('FEEDBACK_GLOBAL_LIMIT_PER_DAY') || '100', 10);

const globalLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(globalDailyLimit, "1 d"),
  ephemeralCache: globalCacheMap,
  prefix: "ratelimit:global:feedback"
}) : null;

const userDailyLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(userDailyLimit, "1 d"),
  ephemeralCache: userDailyCacheMap,
  prefix: "ratelimit:user:feedback"
}) : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const t0 = performance.now();
  let tAuth = 0;
  let tRateLimit = 0;
  let tDb = 0;

  try {
    // ── 1. Authentication ─────────────────────────────────────────────
    const tAuthStart = performance.now();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnonKey;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    tAuth = Math.round(performance.now() - tAuthStart);

    // ── 2. Rate Limiting (Global & Per-User via Upstash Redis) ────────
    const tRateLimitStart = performance.now();
    if (redis) {
      try {
        // Check Global Daily Limit (100 / day)
        if (globalLimiter) {
          const globalRes = await globalLimiter.limit('global');
          if (!globalRes.success) {
            const retryAfter = Math.ceil((globalRes.reset - Date.now()) / 1000);
            return new Response(
              JSON.stringify({ 
                error: 'Global feedback capacity reached for today. Please try again tomorrow.',
                retry_after_seconds: retryAfter,
                rate_limited: true,
                is_global_limit: true
              }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
            );
          }
        }

        // Check Per-User Daily Limit (10 / day)
        if (userDailyLimiter) {
          const userRes = await userDailyLimiter.limit(user.id);
          if (!userRes.success) {
            const retryAfter = Math.ceil((userRes.reset - Date.now()) / 1000);
            const hours = Math.ceil(retryAfter / 3600);
            return new Response(
              JSON.stringify({ 
                error: `You have reached the daily limit of ${userDailyLimit} feedback submissions. Resets in ${hours} hour${hours > 1 ? 's' : ''}.`,
                retry_after_seconds: retryAfter,
                rate_limited: true,
                is_user_limit: true
              }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": retryAfter.toString() } }
            );
          }
        }
      } catch (err) {
        console.warn("submit-feedback: Rate limiter failed open:", err);
      }
    }
    tRateLimit = Math.round(performance.now() - tRateLimitStart);

    // ── 3. Parse & Validate Payload ───────────────────────────────────
    const body = await req.json();
    const { type, title, description, app_version, os_version, device_info } = body;

    // Validate type
    if (!type || !['bug', 'feedback'].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be either 'bug' or 'feedback'." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate title (3 - 100 chars)
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    if (trimmedTitle.length < 3 || trimmedTitle.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Title must be between 3 and 100 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate description (10 - 1000 chars)
    const trimmedDesc = typeof description === 'string' ? description.trim() : '';
    if (trimmedDesc.length < 10 || trimmedDesc.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Description must be between 10 and 1,000 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Insert into Database ───────────────────────────────────────
    const tDbStart = performance.now();
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error: insertError } = await serviceClient
      .from('feedback_submissions')
      .insert({
        user_id: user.id,
        user_email: user.email || null,
        type,
        title: trimmedTitle,
        description: trimmedDesc,
        app_version: app_version ? String(app_version).slice(0, 50) : null,
        os_version: os_version ? String(os_version).slice(0, 50) : null,
        device_info: (typeof device_info === 'object' && device_info !== null) ? device_info : {},
        status: 'open',
      })
      .select()
      .single();

    if (insertError) {
      console.error("submit-feedback insert error:", insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit feedback. Please try again later.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    tDb = Math.round(performance.now() - tDbStart);

    const totalDuration = Math.round(performance.now() - t0);
    const serverTiming = `auth;dur=${tAuth}, ratelimit;dur=${tRateLimit}, db;dur=${tDb}, total;dur=${totalDuration}`;

    return new Response(
      JSON.stringify({
        success: true,
        message: type === 'bug' ? 'Bug report submitted successfully. Thank you!' : 'Feedback submitted successfully. Thank you!',
        data: {
          id: data.id,
          type: data.type,
          title: data.title,
          created_at: data.created_at,
        }
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Server-Timing': serverTiming
        }
      }
    );

  } catch (err: any) {
    console.error("submit-feedback unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
