-- =============================================================================
-- Migration 017: Set Default byok_enabled to True
-- Allows all users (existing and new) to configure their custom Gemini API key
-- =============================================================================

-- 1. Update column default
ALTER TABLE public.user_ai_settings
ALTER COLUMN byok_enabled SET DEFAULT true;

-- 2. Backfill existing records to true
UPDATE public.user_ai_settings
SET byok_enabled = true
WHERE byok_enabled IS FALSE OR byok_enabled IS NULL;

-- 3. Update new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_ai_model()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_ai_settings (user_id, ai_model, byok_enabled)
  VALUES (new.id, 'gemini-3.6-flash', true)
  ON CONFLICT (user_id) DO UPDATE SET byok_enabled = true;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update get_ai_settings() RPC fallback
CREATE OR REPLACE FUNCTION public.get_ai_settings()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_record record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT byok_enabled, custom_api_key IS NOT NULL as has_custom_key
  INTO v_record
  FROM public.user_ai_settings
  WHERE user_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'byok_enabled', COALESCE(v_record.byok_enabled, true),
      'has_custom_key', v_record.has_custom_key
    );
  ELSE
    RETURN jsonb_build_object(
      'byok_enabled', true,
      'has_custom_key', false
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
