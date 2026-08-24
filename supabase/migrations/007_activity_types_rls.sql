-- Enable RLS
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_catalog_versions ENABLE ROW LEVEL SECURITY;

-- Grant select access
GRANT SELECT ON public.activity_types TO authenticated;
GRANT SELECT ON public.activity_types TO anon;

GRANT SELECT ON public.activity_catalog_versions TO authenticated;
GRANT SELECT ON public.activity_catalog_versions TO anon;

-- Create policies for everyone to read
CREATE POLICY "Allow read access to activity types for everyone" ON public.activity_types FOR SELECT USING (true);
CREATE POLICY "Allow read access to catalog versions for everyone" ON public.activity_catalog_versions FOR SELECT USING (true);
