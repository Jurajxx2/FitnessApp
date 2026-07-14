-- Align the generated-plan RPC with the codebase convention (see
-- 20260713100127: public RPCs are SECURITY INVOKER; the private function is
-- the SECURITY DEFINER admin gate). Clears advisor 0029 for the wrapper.
CREATE OR REPLACE FUNCTION public.admin_save_generated_meal_plan(
  p_plan_id UUID, p_user_id UUID, p_name TEXT, p_description TEXT,
  p_target_id UUID, p_days JSONB, p_score REAL, p_diagnostics JSONB
)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $$
  SELECT private.admin_save_generated_meal_plan(
    p_plan_id, p_user_id, p_name, p_description, p_target_id, p_days, p_score, p_diagnostics
  );
$$;

REVOKE ALL ON FUNCTION private.admin_save_generated_meal_plan(UUID, UUID, TEXT, TEXT, UUID, JSONB, REAL, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_save_generated_meal_plan(UUID, UUID, TEXT, TEXT, UUID, JSONB, REAL, JSONB) TO authenticated;
