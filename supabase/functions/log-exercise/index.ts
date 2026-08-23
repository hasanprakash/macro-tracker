import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const geminiPrompt = `
Extract the exercise type and duration in minutes from the user's description.
The exercise_type MUST be one of the following standard MET categories:
- weightlifting_heavy (MET 5.0)
- strength_training (MET 5.0)
- walking_light (MET 3.0)
- running_moderate (MET 8.3)
- yoga (MET 2.5)
- cycling_moderate (MET 6.8)
- swimming_moderate (MET 6.0)
- hiit (MET 8.0)
- basketball (MET 6.5)

If the user's exercise does not perfectly match, pick the closest one.
Return ONLY a JSON object with 'exercise_type' (string) and 'duration_minutes' (number).
`;

const schema = {
  type: "object",
  properties: {
    exercise_type: { type: "string" },
    duration_minutes: { type: "number" }
  },
  required: ["exercise_type", "duration_minutes"]
};

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

    const body = await req.json();
    const { text } = body;

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Must provide text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";
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
      const err = await response.text();
      throw new Error(`Gemini API error: ${err}`);
    }

    const geminiData = await response.json();
    const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(geminiText);
    } catch (_e) {
      throw new Error("Gemini response was not valid JSON");
    }

    return new Response(
      JSON.stringify({ success: true, data: parsedResponse }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("log-exercise error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
