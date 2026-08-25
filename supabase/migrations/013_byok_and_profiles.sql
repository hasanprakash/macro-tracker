-- =============================================================================
-- Migration: BYOK & Profiles
-- 1. Add full_name to profiles
-- 2. Rename user_ai_models to user_ai_settings
-- 3. Add custom_api_key and byok_enabled to user_ai_settings
-- 4. Create secure RPCs for clients to read their config and update their key
-- =============================================================================

-- 1. Profiles updates
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name text;

-- 2. Rename the AI table
ALTER TABLE IF EXISTS public.user_ai_models 
RENAME TO user_ai_settings;

-- 3. Add BYOK columns
ALTER TABLE public.user_ai_settings
ADD COLUMN IF NOT EXISTS custom_api_key text,
ADD COLUMN IF NOT EXISTS byok_enabled boolean default false;

-- Drop the old trigger if it still has the old name and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created_assign_ai_model ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user_ai_model()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_ai_settings (user_id, ai_model)
  VALUES (new.id, 'gemini-3.6-flash');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_assign_ai_model
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_ai_model();


-- 4. Create Secure RPCs

-- A. get_ai_settings()
-- Allows a user to check if they have BYOK enabled and if they have a key set.
-- Security definer allows it to read the locked user_ai_settings table on behalf of the user.
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
      'byok_enabled', v_record.byok_enabled,
      'has_custom_key', v_record.has_custom_key
    );
  ELSE
    RETURN jsonb_build_object(
      'byok_enabled', false,
      'has_custom_key', false
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. update_custom_api_key(new_key)
-- Allows a user to set their API key securely without exposing the table.
CREATE OR REPLACE FUNCTION public.update_custom_api_key(new_key text)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_ai_settings
  SET custom_api_key = new_key, updated_at = now()
  WHERE user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
