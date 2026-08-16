import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const geminiPrompt = `
Analyze the provided meal (either through text description or image). 
Identify the food items, estimate their quantities, and provide the nutritional macros.
You MUST respond with ONLY a valid JSON object in the following format, with no markdown formatting or extra text:

{
  "meal_name": "Name of the overall meal",
  "foods": [
    {
      "name": "Food item 1",
      "quantity": "Amount (e.g. 200g, 1 cup, 1 piece)"
    }
  ],
  "nutrition": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fiber": 0,
    "sugar": 0,
    "sodium": 0
  },
  "confidence": 0.95
}

For the nutritional values, provide numeric values only (no units in the nutrition object). If a value is unknown, make your best educated guess.
`;

Deno.serve(async (req) => {
  console.log("supabase log-meal started...");
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    console.log(
      "Supabase URL configured:",
      !!supabaseUrl
    );

    console.log(
      "Supabase anon key configured:",
      !!supabaseAnonKey
    );
    const authorization = req.headers.get("Authorization");

    const authResponse = await fetch(
      "http://kong:8000/auth/v1/user",
      {
        headers: {
          Authorization: authorization!,
          apikey: supabaseAnonKey,
        },
      }
    );

    const authBody = await authResponse.text();

    console.log("DIRECT AUTH STATUS:", authResponse.status);
    console.log("DIRECT AUTH RESPONSE:", authBody);

    console.log(
      "Authorization present:",
      !!authorization
    );

    console.log(
      "Authorization starts with Bearer:",
      authorization?.startsWith("Bearer ")
    );

    if (!authorization) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    );

    const accessToken = authorization.substring(7);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    console.log("USER:", user?.id);
    console.log("ERROR:", error?.message);

    if (error || !user) {
      console.error("Authentication failed:", error);

      return new Response(
        JSON.stringify({
          error: "Unauthorized",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();
    const { meal_type, text, image_base64 } = body;

    if (!text && !image_base64) {
      return new Response(JSON.stringify({ error: 'Must provide either text or image_base64' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    // Build Gemini request parts
    const parts: any[] = [{ text: geminiPrompt }];
    
    if (text) {
      parts.push({ text: `User text description: ${text}` });
    }
    
    if (image_base64) {
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: image_base64
        }
      });
    }

    console.log("Calling Gemini...");

    // Call Gemini
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
        },
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

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(geminiText);
    } catch (e) {
      console.error("Gemini raw text:", geminiText);
      throw new Error("Gemini response was not valid JSON");
    }

    let imagePath = null;
    
    // Upload image to Storage if provided
    if (image_base64) {
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
          contentType: 'image/jpeg'
        });
        
      if (uploadError) {
        console.error("Failed to upload image:", uploadError);
      } else {
        imagePath = uploadData.path;
      }
    }

    // Insert into food_entries
    const { data: entryData, error: entryError } = await supabase
      .from('food_entries')
      .insert({
        user_id: user.id,
        meal_type: meal_type || 'Unknown',
        meal_name: parsedResponse.meal_name,
        notes: text || null,
        calories: parsedResponse.nutrition.calories,
        protein: parsedResponse.nutrition.protein,
        carbs: parsedResponse.nutrition.carbs,
        fat: parsedResponse.nutrition.fat,
        fiber: parsedResponse.nutrition.fiber,
        sugar: parsedResponse.nutrition.sugar,
        sodium: parsedResponse.nutrition.sodium,
        image_path: imagePath,
        raw_input: text ? JSON.stringify({ text }) : JSON.stringify({ image: true }),
        ai_provider: 'google',
        ai_model: 'gemini-3.5-flash',
        ai_response_json: parsedResponse,
        confidence: parsedResponse.confidence
      })
      .select()
      .single();

    if (entryError) {
      console.error("DB Insert Error:", entryError);
      throw new Error("Failed to save meal entry");
    }

    // Update daily_summaries (upsert)
    const today = new Date().toISOString().split('T')[0];
    
    // First, fetch the current summary
    const { data: currentSummary } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', user.id)
      .eq('summary_date', today)
      .single();

    if (currentSummary) {
      // Update
      await supabase
        .from('daily_summaries')
        .update({
          total_calories: (currentSummary.total_calories || 0) + parsedResponse.nutrition.calories,
          total_protein: (currentSummary.total_protein || 0) + parsedResponse.nutrition.protein,
          total_carbs: (currentSummary.total_carbs || 0) + parsedResponse.nutrition.carbs,
          total_fat: (currentSummary.total_fat || 0) + parsedResponse.nutrition.fat,
          total_fiber: (currentSummary.total_fiber || 0) + parsedResponse.nutrition.fiber,
          meal_count: (currentSummary.meal_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSummary.id);
    } else {
      // Insert
      await supabase
        .from('daily_summaries')
        .insert({
          user_id: user.id,
          summary_date: today,
          total_calories: parsedResponse.nutrition.calories,
          total_protein: parsedResponse.nutrition.protein,
          total_carbs: parsedResponse.nutrition.carbs,
          total_fat: parsedResponse.nutrition.fat,
          total_fiber: parsedResponse.nutrition.fiber,
          meal_count: 1
        });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: parsedResponse,
      entry: entryData
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
