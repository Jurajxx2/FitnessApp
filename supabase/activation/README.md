# Gated database activation templates

Files in this directory are reviewed SQL templates, not active Supabase
migrations. They are intentionally excluded from `supabase/migrations`, so
normal database pushes cannot apply a gated behavior change prematurely.

Follow the template's verification runbook. Only after every gate passes,
create a fresh timestamped migration with `supabase migration new`, copy the
reviewed template into it unchanged, review the pending migration order, and
apply it through the separate activation stage.
