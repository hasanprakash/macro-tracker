import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // ── Validate Payload ─────────────────────────────────────────────
    const body = await req.json();
    const { meal_type, meal_name, title, foods, totals, image_base64 } = body;

    if (!meal_type || !meal_name || !Array.isArray(foods) || foods.length === 0 || !totals) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: meal_type, meal_name, foods, totals' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Upload Image (if provided) ───────────────────────────────────
    let imagePath = null;

    if (image_base64) {
      try {
        const binaryStr = atob(image_base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const fileName = `${user.id}/${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meal-images')
          .upload(fileName, bytes.buffer, {
            contentType: 'image/jpeg',
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
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('insert_meal_transaction', {
      p_meal_type: meal_type,
      p_meal_name: meal_name,
      p_calories: totals.calories,
      p_protein: totals.protein_g,
      p_carbs: totals.carbs_g,
      p_fat: totals.fat_g,
      p_image_path: imagePath,
      p_raw_input: { foods },
      p_ai_response_json: { meal_name, title, foods, totals },
      p_foods: foods,
      p_title: title
    });

    if (rpcError) {
      console.error("DB RPC Error (insert_meal_transaction):", rpcError);
      throw new Error("Failed to save meal entry completely");
    }

    const entryData = rpcData.entry;

    console.log("log-meal: Saved", meal_name, "for user", user.id);

    // ── Return ───────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        entry: entryData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("log-meal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
