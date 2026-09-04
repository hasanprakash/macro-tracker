-- =============================================================================
-- Migration 024: Set Default AI Model to Gemini 3.5 Flash Lite
-- Sets Gemini 3.5 Flash Lite as our default model for meal scans
-- =============================================================================

-- 1. Update column default
ALTER TABLE public.user_ai_settings
ALTER COLUMN ai_model SET DEFAULT 'gemini-3.5-flash-lite';

-- 2. Update new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_ai_model()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_ai_settings (user_id, ai_model, byok_enabled)
  VALUES (new.id, 'gemini-3.5-flash-lite', true)
  ON CONFLICT (user_id) DO UPDATE SET 
    ai_model = EXCLUDED.ai_model,
    byok_enabled = EXCLUDED.byok_enabled;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update existing users currently on gemini-3.6-flash or older defaults
UPDATE public.user_ai_settings
SET ai_model = 'gemini-3.5-flash-lite'
WHERE ai_model = 'gemini-3.6-flash' OR ai_model = 'gemini-3.5-flash';
