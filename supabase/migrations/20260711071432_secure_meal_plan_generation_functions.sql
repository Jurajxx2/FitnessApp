-- Keep every privileged function in the unexposed private schema and make it
-- callable only by server-side service_role code. The public resolvers are
-- SECURITY INVOKER read façades, so their table reads remain subject to RLS.

CREATE OR REPLACE FUNCTION private.get_active_nutrition_target(p_user_id UUID)
RETURNS SETOF public.nutrition_targets
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (SELECT auth.role()) <> 'service_role'
    AND (
      (SELECT auth.uid()) IS NULL
      OR ((SELECT auth.uid()) <> p_user_id AND NOT (SELECT public.get_is_admin()))
    )
  THEN
    RAISE EXCEPTION 'not authorized to resolve this nutrition target'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT nt.*
  FROM public.nutrition_targets nt
  WHERE nt.user_id = p_user_id AND nt.effective_to IS NULL
  ORDER BY
    CASE
      WHEN nt.source = 'admin' AND nt.is_locked THEN 0
      WHEN nt.source = 'admin' THEN 1
      WHEN nt.source = 'user' THEN 2
      ELSE 3
    END,
    nt.version DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_nutrition_target(p_user_id UUID)
RETURNS SETOF public.nutrition_targets
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT nt.*
  FROM public.nutrition_targets nt
  WHERE nt.user_id = p_user_id
    AND nt.effective_to IS NULL
    AND (
      (SELECT auth.uid()) = p_user_id
      OR (SELECT public.get_is_admin())
    )
  ORDER BY
    CASE
      WHEN nt.source = 'admin' AND nt.is_locked THEN 0
      WHEN nt.source = 'admin' THEN 1
      WHEN nt.source = 'user' THEN 2
      ELSE 3
    END,
    nt.version DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.get_current_meal_plan_id(p_user_id UUID)
RETURNS TABLE(meal_plan_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (SELECT auth.role()) <> 'service_role'
    AND (
      (SELECT auth.uid()) IS NULL
      OR ((SELECT auth.uid()) <> p_user_id AND NOT (SELECT public.get_is_admin()))
    )
  THEN
    RAISE EXCEPTION 'not authorized to resolve this meal plan'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ump.meal_plan_id
  FROM public.user_meal_plans ump
  WHERE ump.user_id = p_user_id AND ump.status = 'current'
  ORDER BY ump.effective_from DESC, ump.assigned_at DESC NULLS LAST, ump.id DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_meal_plan_id(p_user_id UUID)
RETURNS TABLE(meal_plan_id UUID)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT ump.meal_plan_id
  FROM public.user_meal_plans ump
  WHERE ump.user_id = p_user_id
    AND ump.status = 'current'
    AND (
      (SELECT auth.uid()) = p_user_id
      OR (SELECT public.get_is_admin())
    )
  ORDER BY ump.effective_from DESC, ump.assigned_at DESC NULLS LAST, ump.id DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.publish_meal_plan(p_user_id UUID, p_meal_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  plan_origin TEXT;
  plan_user_id UUID;
  is_server_call BOOLEAN := (SELECT auth.role()) = 'service_role';
BEGIN
  SELECT origin, user_id INTO plan_origin, plan_user_id
  FROM public.meal_plans
  WHERE id = p_meal_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'meal plan % does not exist', p_meal_plan_id;
  END IF;

  IF NOT is_server_call AND (
    (SELECT auth.uid()) IS NULL
    OR ((SELECT auth.uid()) <> p_user_id AND NOT (SELECT public.get_is_admin()))
  ) THEN
    RAISE EXCEPTION 'not authorized to publish this meal plan'
      USING ERRCODE = '42501';
  END IF;

  IF plan_origin = 'generated' AND plan_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'generated meal plans can only be assigned to their owner';
  END IF;

  IF NOT is_server_call
    AND (SELECT auth.uid()) = p_user_id
    AND (plan_origin <> 'generated' OR plan_user_id IS DISTINCT FROM p_user_id)
  THEN
    RAISE EXCEPTION 'users may only publish their own generated meal-plan draft'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_meal_plans
  SET status = 'superseded', effective_to = now()
  WHERE user_id = p_user_id AND status = 'current';

  INSERT INTO public.user_meal_plans (
    user_id, meal_plan_id, status, effective_from, effective_to
  ) VALUES (
    p_user_id, p_meal_plan_id, 'current', now(), NULL
  )
  ON CONFLICT (user_id, meal_plan_id) DO UPDATE
  SET status = 'current', effective_from = EXCLUDED.effective_from, effective_to = NULL;

  UPDATE public.meal_plans
  SET generation_status = CASE WHEN origin = 'generated' THEN 'published' ELSE generation_status END
  WHERE id = p_meal_plan_id;

  RETURN p_meal_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_meal_plan(p_user_id UUID, p_meal_plan_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $$
  SELECT private.publish_meal_plan(p_user_id, p_meal_plan_id);
$$;

REVOKE ALL ON SCHEMA private FROM authenticated;
REVOKE ALL ON FUNCTION private.get_active_nutrition_target(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION private.get_current_meal_plan_id(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION private.publish_meal_plan(UUID, UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_active_nutrition_target(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_meal_plan_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_meal_plan(UUID, UUID) FROM PUBLIC;

GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.get_active_nutrition_target(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION private.get_current_meal_plan_id(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION private.publish_meal_plan(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_active_nutrition_target(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_meal_plan_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_meal_plan(UUID, UUID) TO service_role;
