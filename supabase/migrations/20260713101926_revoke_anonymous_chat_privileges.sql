-- Anonymous clients have no chat policies, so retain no table or column grants.
-- Authenticated access is intentionally defined in the preceding hardening migration.
REVOKE ALL PRIVILEGES ON TABLE public.chat_messages FROM anon;
