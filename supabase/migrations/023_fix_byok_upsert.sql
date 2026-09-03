-- =============================================================================
-- Migration 023: Fix BYOK update_custom_api_key UPSERT
-- Ensures updating the custom API key works for all users (inserts if missing)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_custom_api_key(new_key text)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_clean_key text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean_key := NULLIF(trim(new_key), '');

  INSERT INTO public.user_ai_settings (user_id, custom_api_key, byok_enabled, updated_at)
  VALUES (v_user_id, v_clean_key, true, now())
  ON CONFLICT (user_id) DO UPDATE
  SET custom_api_key = EXCLUDED.custom_api_key,
      byok_enabled = true,
      updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
