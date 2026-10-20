-- Public read access for the tests table, following the pattern recommended in
-- the Supabase Next.js quickstart:
--   1. GRANT SELECT to the anon role (see previous migration)
--   2. Enable Row Level Security (fresh projects have RLS on by default)
--   3. Add a policy that allows the anon role to read all rows
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public can read tests" ON public.tests;
CREATE POLICY "public can read tests"
  ON public.tests
  FOR SELECT TO anon
  USING (true);
