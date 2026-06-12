-- Advisor fix (extension_in_public): pg_trgm should not live in the public schema.
-- NOT YET APPLIED to the remote project — needs explicit approval.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
