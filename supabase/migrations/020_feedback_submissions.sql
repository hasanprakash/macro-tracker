-- =============================================================================
-- Migration 020: Create Feedback Submissions Table & RLS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email text,
  type text NOT NULL CHECK (type IN ('bug', 'feedback')),
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 100),
  description text NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 1000),
  app_version text,
  os_version text,
  device_info jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON public.feedback_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status_type ON public.feedback_submissions(status, type);

-- Enable RLS
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own feedback"
  ON public.feedback_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback submissions"
  ON public.feedback_submissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role has full access by default
GRANT ALL ON public.feedback_submissions TO authenticated, service_role;
