-- Newer Supabase projects do not automatically expose newly created tables to
-- the API roles (anon/authenticated). Grant read access so the web app, which
-- authenticates with the anon/publishable key, can query the tests table.
GRANT SELECT ON TABLE public.tests TO anon;
