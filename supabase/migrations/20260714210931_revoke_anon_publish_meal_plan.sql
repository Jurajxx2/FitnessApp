-- User-scoped nutrition resolvers and publication remain available to signed-in
-- callers and trusted backend jobs, never through default PUBLIC execution.
REVOKE EXECUTE ON FUNCTION public.get_active_nutrition_target(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_current_meal_plan_id(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.publish_meal_plan(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_nutrition_target(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_meal_plan_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_meal_plan(UUID, UUID) TO authenticated, service_role;
