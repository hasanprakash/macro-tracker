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
    const { meal_type, meal_name, foods, totals, image_base64 } = body;

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

    // ── Insert into food_entries ──────────────────────────────────────
    const { data: entryData, error: entryError } = await supabase
      .from('food_entries')
      .insert({
        user_id: user.id,
        meal_type: meal_type,
        meal_name: meal_name,
        calories: totals.calories,
        protein: totals.protein_g,
        carbs: totals.carbs_g,
        fat: totals.fat_g,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        image_path: imagePath,
        raw_input: JSON.stringify({ foods }),
        ai_provider: 'google',
        ai_model: 'gemini-3.5-flash',
        ai_response_json: { meal_name, foods, totals },
      })
      .select()
      .single();

    if (entryError) {
      console.error("DB Insert Error (food_entries):", entryError);
      throw new Error("Failed to save meal entry");
    }

    // ── Upsert daily_summaries ───────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];

    const { data: currentSummary } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', user.id)
      .eq('summary_date', today)
      .single();

    if (currentSummary) {
      await supabase
        .from('daily_summaries')
        .update({
          total_calories: (currentSummary.total_calories || 0) + totals.calories,
          total_protein: (currentSummary.total_protein || 0) + totals.protein_g,
          total_carbs: (currentSummary.total_carbs || 0) + totals.carbs_g,
          total_fat: (currentSummary.total_fat || 0) + totals.fat_g,
          meal_count: (currentSummary.meal_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSummary.id);
    } else {
      await supabase
        .from('daily_summaries')
        .insert({
          user_id: user.id,
          summary_date: today,
          total_calories: totals.calories,
          total_protein: totals.protein_g,
          total_carbs: totals.carbs_g,
          total_fat: totals.fat_g,
          total_fiber: 0,
          meal_count: 1,
        });
    }

    // ── Upsert recent_foods (case-insensitive meal_name match) ───────
    // Check if a recent food with the same name already exists for this user.
    // Uses case-insensitive comparison via ilike.
    const { data: existingRecent } = await supabase
      .from('recent_foods')
      .select('*')
      .eq('user_id', user.id)
      .ilike('meal_name', meal_name)
      .single();

    if (existingRecent) {
      // Update existing: bump count and refresh data
      await supabase
        .from('recent_foods')
        .update({
          foods: foods,
          total_calories: totals.calories,
          total_protein: totals.protein_g,
          total_carbs: totals.carbs_g,
          total_fat: totals.fat_g,
          used_count: (existingRecent.used_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existingRecent.id);
    } else {
      // Insert new recent food
      await supabase
        .from('recent_foods')
        .insert({
          user_id: user.id,
          meal_name: meal_name,
          foods: foods,
          total_calories: totals.calories,
          total_protein: totals.protein_g,
          total_carbs: totals.carbs_g,
          total_fat: totals.fat_g,
          used_count: 1,
          last_used_at: new Date().toISOString(),
        });
    }

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
