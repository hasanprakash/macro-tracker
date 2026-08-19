import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

Nutrition values must be numeric and represent the entire meal.
If the exact quantity is unclear, make a reasonable estimate.
Do not invent foods that are not reasonably identifiable from the input.
For confidence, provide a value between 0 and 1.
`;

// Define the precise shape of the data we want back to force structured output
const macroSchema = {
  type: "object",
  properties: {
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
  required: ["meal_name", "foods", "totals", "confidence"]
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

    // ── Validate Input ───────────────────────────────────────────────
    const body = await req.json();
    const { text, image_base64 } = body;

    if (!text && !image_base64) {
      return new Response(
        JSON.stringify({ error: 'Must provide either text, image_base64, or both' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Build Gemini Request ─────────────────────────────────────────
    const apiKey = Deno.env.get('GEMINI_API_KEY');
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
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

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
      const err = await response.text();
      throw new Error(`Gemini API error: ${err}`);
    }

    const geminiData = await response.json();
    const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!geminiText) {
      throw new Error("Failed to parse Gemini response text");
    }

    // ── Parse & Validate Response ────────────────────────────────────
    // Safely parse it directly without regex cleanup or brace checking
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(geminiText);
    } catch (_e) {
      console.error("Gemini raw text:", geminiText);
      throw new Error("Gemini response was not valid JSON");
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
