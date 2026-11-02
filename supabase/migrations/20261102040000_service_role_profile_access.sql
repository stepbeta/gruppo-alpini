-- ==========================================
-- SERVICE ROLE PROFILE ACCESS
-- ==========================================
-- The account deletion route validates the caller with the Auth admin API and,
-- when an administrator deletes another member, reads `profiles.is_admin` with
-- the server-side service role.
--
-- Supabase does not grant table privileges to the API roles automatically. The
-- existing migrations granted profile access to `authenticated` only, so the
-- service-role query returned 42501 and administrators could not delete another
-- account. This grant keeps the key server-side and covers that check.

grant select on table public.profiles to service_role;
