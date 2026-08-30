import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.3";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// We keep the prompt rules to guide Gemini on how to interpret quantities,
// but rely on responseSchema for the strict JSON structure.
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

// Define the precise shape of the data we want back to force structured output
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

  try {
    // ── Auth ──────────────────────────────────────────────────────────
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
    const { text, image_base64, idempotency_key } = body;
    const idempotencyId = req.headers.get('x-idempotency-key') || idempotency_key || null;

    if (!text && !image_base64) {
      return new Response(
        JSON.stringify({ error: 'Must provide either text, image_base64, or both' }),
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
        const cached = await redis.get(`idempotent:scan-food:${user.id}:${idempotencyId}`);
        if (cached) {
          console.log("scan-food: Cache HIT for idempotency key:", idempotencyId);
          const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return new Response(
            JSON.stringify({ success: true, data: cachedData, cached: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } }
          );
        }
      } catch (cacheErr) {
        console.warn("scan-food: Idempotency cache lookup failed:", cacheErr);
      }
    }

    // ── Rate Limiting (Upstash Redis) ────────────────────────────────
    // Bypass rate limiting if the user brought their own API key
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

      // Composite key using userId and IP address
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
          JSON.stringify({ error: "Daily limit reached. You can only analyze 6 meals per day on the free tier." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Build Gemini Request ─────────────────────────────────────────
    const apiKey = customApiKey || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const parts: any[] = [{ text: geminiPrompt }];

    // Text and image can be sent together
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

    console.log("scan-food: Calling Gemini...");

    // ── Call Gemini ──────────────────────────────────────────────────
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent`;

    const response = await fetch(geminiUrl, {
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

    if (!geminiText) {
      throw new Error("Failed to parse Gemini response text");
    }

    // ── Parse & Validate Response ────────────────────────────────────
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(geminiText);
    } catch (_e) {
      console.error("Gemini raw text:", geminiText);
      throw new Error("Gemini response was not valid JSON");
    }

    // ── Cache for Idempotency (10 minute TTL) ────────────────────────
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

    console.log("scan-food: Success -", parsedResponse.meal_name);

    // ── Return Estimate (NO DB write) ────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        data: parsedResponse,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("scan-food error:", error);
    
    let friendlyMessage = error.message || "An unexpected error occurred.";
    if (friendlyMessage.includes('high demand') || friendlyMessage.includes('503') || friendlyMessage.includes('overloaded')) {
      friendlyMessage = "Our AI is currently experiencing high demand. Please try again in a moment.";
    }

    // Return 200 with an error property so the client SDK doesn't throw a generic "Edge Function returned a non-2xx status code" error.
    return new Response(
      JSON.stringify({ error: friendlyMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
