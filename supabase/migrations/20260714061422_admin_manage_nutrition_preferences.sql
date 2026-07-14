-- Admins manage every athlete's nutrition preferences (used as generator input).
-- The table already has: owner-only ALL policy + admin SELECT policy.
CREATE POLICY "Admins manage all preferences"
  ON public.user_nutrition_preferences FOR ALL TO authenticated
  USING ((SELECT public.get_is_admin()))
  WITH CHECK ((SELECT public.get_is_admin()));
