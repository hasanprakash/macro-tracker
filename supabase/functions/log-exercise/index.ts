import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.3";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dynamic prompt will be generated inside the handler


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    // ── Fetch User's Assigned AI Model & Settings ────────────────────
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

    // ── Parse & Validate Input ───────────────────────────────────────
    const body = await req.json();
    const { text, weight = 70, idempotency_key } = body;
    const idempotencyId = req.headers.get('x-idempotency-key') || idempotency_key || null;

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Must provide text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Initialize Redis (for Idempotency & Rate Limiting) ───────────
    const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
    const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
    const redis = (redisUrl && redisToken) ? new Redis({ url: redisUrl, token: redisToken }) : null;

    // ── Idempotency Check: Return cached AI response if replayed ──────
    if (idempotencyId && redis) {
      try {
        const cached = await redis.get(`idempotent:log-exercise:${user.id}:${idempotencyId}`);
        if (cached) {
          console.log("log-exercise: Cache HIT for idempotency key:", idempotencyId);
          const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return new Response(
            JSON.stringify({ success: true, data: cachedData, cached: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } }
          );
        }
      } catch (cacheErr) {
        console.warn("log-exercise: Idempotency cache lookup failed:", cacheErr);
      }
    }

    // ── Rate Limiting (Upstash Redis) ────────────────────────────────
    if (!customApiKey && redis) {
      const limitMinute = parseInt(Deno.env.get('AI_LIMIT_PER_MINUTE') || '3', 10);
      const ratelimitMinute = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(limitMinute, "1 m"),
        ephemeralCache: new Map(),
        prefix: "ratelimit:minute"
      });
      
      const limitDay = parseInt(Deno.env.get('AI_LIMIT_PER_DAY') || '6', 10);
      const ratelimitDay = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(limitDay, "1 d"),
        ephemeralCache: new Map(),
        prefix: "ratelimit:day"
      });

      const ip = req.headers.get('x-forwarded-for') || 'unknown-ip';
      const identifier = `${user.id}:${ip}`;

      const { success: successMinute } = await ratelimitMinute.limit(identifier);
      if (!successMinute) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please wait a minute before trying again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { success: successDay } = await ratelimitDay.limit(identifier);
      if (!successDay) {
        return new Response(
          JSON.stringify({ error: "Daily limit reached. You can only analyze 6 entries per day on the free tier." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: activities, error: actError } = await supabase
      .from('activity_types')
      .select('code, name, met')
      .eq('is_active', true);

    if (actError || !activities || activities.length === 0) {
      throw new Error('Failed to load activity types');
    }

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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent`;
    const response = await fetch(geminiUrl, {
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
      throw new Error(niceError);
    }

    const geminiData = await response.json();
    const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(geminiText);
    } catch (_e) {
      throw new Error("Gemini response was not valid JSON");
    }

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

    // ── Cache for Idempotency (10 minute TTL) ────────────────────────
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

    return new Response(
      JSON.stringify({ success: true, data: finalResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
