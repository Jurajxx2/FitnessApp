-- Phase 1 — versioned nutrition targets and deterministic meal-plan ownership.
-- Generated-plan writes are intentionally reserved for the Edge Function's
-- server role. Public resolver functions are SECURITY INVOKER wrappers; all
-- SECURITY DEFINER work stays in the unexposed private schema.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE public.nutrition_targets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('calculated', 'user', 'admin')),
  created_by      UUID REFERENCES auth.users(id),
  calories        REAL NOT NULL CHECK (calories > 0),
  protein_g       REAL NOT NULL CHECK (protein_g >= 0),
  carbs_g         REAL NOT NULL CHECK (carbs_g >= 0),
  fat_g           REAL NOT NULL CHECK (fat_g >= 0),
  fiber_g_min     REAL CHECK (fiber_g_min IS NULL OR fiber_g_min >= 0),
  calorie_tol_pct REAL NOT NULL DEFAULT 5 CHECK (calorie_tol_pct >= 0 AND calorie_tol_pct <= 100),
  protein_tol_pct REAL NOT NULL DEFAULT 10 CHECK (protein_tol_pct >= 0 AND protein_tol_pct <= 100),
  carbs_tol_pct   REAL NOT NULL DEFAULT 15 CHECK (carbs_tol_pct >= 0 AND carbs_tol_pct <= 100),
  fat_tol_pct     REAL NOT NULL DEFAULT 15 CHECK (fat_tol_pct >= 0 AND fat_tol_pct <= 100),
  version         INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  is_locked       BOOLEAN NOT NULL DEFAULT false,
  effective_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (user_id, version)
);

ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own targets"
  ON public.nutrition_targets FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users insert own unlocked targets"
  ON public.nutrition_targets FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND is_locked = false AND source = 'user');

CREATE POLICY "Admins manage all targets"
  ON public.nutrition_targets FOR ALL TO authenticated
  USING ((SELECT public.get_is_admin()))
  WITH CHECK ((SELECT public.get_is_admin()));

CREATE INDEX idx_nutrition_targets_user_open
  ON public.nutrition_targets(user_id) WHERE effective_to IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_targets TO authenticated;

CREATE TABLE public.user_nutrition_preferences (
  user_id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dietary_patterns           TEXT[] NOT NULL DEFAULT '{}',
  excluded_allergens         TEXT[] NOT NULL DEFAULT '{}',
  disliked_recipe_ids        UUID[] NOT NULL DEFAULT '{}',
  favourite_recipe_ids       UUID[] NOT NULL DEFAULT '{}',
  meals_per_day              INTEGER NOT NULL DEFAULT 3 CHECK (meals_per_day BETWEEN 2 AND 6),
  include_snack              BOOLEAN NOT NULL DEFAULT false,
  meal_distribution          JSONB,
  max_prep_time_min          INTEGER CHECK (max_prep_time_min IS NULL OR max_prep_time_min > 0),
  max_recipe_repeats_per_week INTEGER NOT NULL DEFAULT 2 CHECK (max_recipe_repeats_per_week >= 0),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_nutrition_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.user_nutrition_preferences FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins read all preferences"
  ON public.user_nutrition_preferences FOR SELECT TO authenticated
  USING ((SELECT public.get_is_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_nutrition_preferences TO authenticated;

ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual', 'generated')),
  ADD COLUMN IF NOT EXISTS nutrition_target_id UUID REFERENCES public.nutrition_targets(id),
  ADD COLUMN IF NOT EXISTS target_version INTEGER,
  ADD COLUMN IF NOT EXISTS generation_status TEXT
    CHECK (generation_status IN ('generating', 'draft', 'published', 'superseded', 'failed')),
  ADD COLUMN IF NOT EXISTS algorithm_version TEXT,
  ADD COLUMN IF NOT EXISTS score REAL,
  ADD COLUMN IF NOT EXISTS diagnostics JSONB,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

ALTER TABLE public.meal_plan_recipes
  ALTER COLUMN recipe_id DROP NOT NULL;

ALTER TABLE public.meal_plan_recipes
  DROP CONSTRAINT IF EXISTS meal_plan_recipes_recipe_id_fkey,
  ADD CONSTRAINT meal_plan_recipes_recipe_id_fkey
    FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slot_kind TEXT NOT NULL DEFAULT 'recipe'
    CHECK (slot_kind IN ('recipe', 'external')),
  ADD COLUMN IF NOT EXISTS portion_multiplier NUMERIC NOT NULL DEFAULT 1
    CHECK (portion_multiplier > 0),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_group_id UUID,
  ADD COLUMN IF NOT EXISTS snapshot_recipe_name TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_calories REAL,
  ADD COLUMN IF NOT EXISTS snapshot_protein_g REAL,
  ADD COLUMN IF NOT EXISTS snapshot_carbs_g REAL,
  ADD COLUMN IF NOT EXISTS snapshot_fat_g REAL,
  ADD COLUMN IF NOT EXISTS snapshot_fiber_g REAL;

ALTER TABLE public.meal_plan_recipes
  ADD CONSTRAINT mpr_slot_shape CHECK (
    (slot_kind = 'recipe' AND recipe_id IS NOT NULL)
    OR (slot_kind = 'external' AND recipe_id IS NULL AND snapshot_calories IS NOT NULL)
  );

ALTER TABLE public.user_meal_plans
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'current'
    CHECK (status IN ('current', 'superseded', 'draft')),
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ;

-- Legacy assignments had no lifecycle. Keep the latest assignment current and
-- preserve earlier rows as history before creating the single-current index.
WITH ranked_assignments AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY assigned_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.user_meal_plans
  WHERE status = 'current'
)
UPDATE public.user_meal_plans ump
SET status = 'superseded', effective_to = now()
FROM ranked_assignments ranked
WHERE ump.id = ranked.id AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ump_one_current
  ON public.user_meal_plans(user_id) WHERE status = 'current';

CREATE TABLE public.meal_plan_generation_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES auth.users(id),
  idempotency_key TEXT NOT NULL,
  input_snapshot  JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'draft', 'failed')),
  meal_plan_id    UUID REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

ALTER TABLE public.meal_plan_generation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own generation requests"
  ON public.meal_plan_generation_requests FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins read all generation requests"
  ON public.meal_plan_generation_requests FOR SELECT TO authenticated
  USING ((SELECT public.get_is_admin()));

GRANT SELECT ON public.meal_plan_generation_requests TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'meal_plan_generation_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_plan_generation_requests;
  END IF;
END;
$$;

-- Preserve nutrition-target versions. Inserting a new target closes only the
-- prior open version from the same source, so a user target cannot replace an
-- admin target and vice versa. The advisory lock makes versions deterministic
-- under concurrent requests.
CREATE OR REPLACE FUNCTION private.prepare_nutrition_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF (SELECT auth.uid()) IS NOT NULL THEN
    NEW.created_by := (SELECT auth.uid());
  END IF;

  NEW.version := COALESCE(
    (SELECT MAX(version) + 1 FROM public.nutrition_targets WHERE user_id = NEW.user_id),
    1
  );
  NEW.effective_from := now();
  NEW.effective_to := NULL;

  UPDATE public.nutrition_targets
  SET effective_to = now()
  WHERE user_id = NEW.user_id
    AND source = NEW.source
    AND effective_to IS NULL;

  UPDATE public.meal_plans mp
  SET generation_status = 'superseded'
  FROM public.user_meal_plans ump
  WHERE ump.user_id = NEW.user_id
    AND ump.status = 'current'
    AND ump.meal_plan_id = mp.id
    AND mp.origin = 'generated'
    AND mp.generation_status IN ('generating', 'draft', 'published');

  RETURN NEW;
END;
$$;

CREATE TRIGGER prepare_nutrition_target
  BEFORE INSERT ON public.nutrition_targets
  FOR EACH ROW EXECUTE FUNCTION private.prepare_nutrition_target();

CREATE OR REPLACE FUNCTION private.prevent_nutrition_target_rewrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'nutrition targets are immutable; create a replacement instead';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.calories IS DISTINCT FROM OLD.calories
    OR NEW.protein_g IS DISTINCT FROM OLD.protein_g
    OR NEW.carbs_g IS DISTINCT FROM OLD.carbs_g
    OR NEW.fat_g IS DISTINCT FROM OLD.fat_g
    OR NEW.fiber_g_min IS DISTINCT FROM OLD.fiber_g_min
    OR NEW.calorie_tol_pct IS DISTINCT FROM OLD.calorie_tol_pct
    OR NEW.protein_tol_pct IS DISTINCT FROM OLD.protein_tol_pct
    OR NEW.carbs_tol_pct IS DISTINCT FROM OLD.carbs_tol_pct
    OR NEW.fat_tol_pct IS DISTINCT FROM OLD.fat_tol_pct
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.is_locked IS DISTINCT FROM OLD.is_locked
    OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR OLD.effective_to IS NOT NULL
    OR NEW.effective_to IS NULL
  THEN
    RAISE EXCEPTION 'nutrition targets are immutable; only an open target may be closed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_nutrition_target_update
  BEFORE UPDATE ON public.nutrition_targets
  FOR EACH ROW EXECUTE FUNCTION private.prevent_nutrition_target_rewrite();

CREATE TRIGGER prevent_nutrition_target_delete
  BEFORE DELETE ON public.nutrition_targets
  FOR EACH ROW EXECUTE FUNCTION private.prevent_nutrition_target_rewrite();

CREATE OR REPLACE FUNCTION private.get_active_nutrition_target(p_user_id UUID)
RETURNS SETOF public.nutrition_targets
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR ((SELECT auth.uid()) <> p_user_id AND NOT (SELECT public.get_is_admin()))
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
SET search_path = pg_catalog, public, private
AS $$
  SELECT * FROM private.get_active_nutrition_target(p_user_id);
$$;

CREATE OR REPLACE FUNCTION private.get_current_meal_plan_id(p_user_id UUID)
RETURNS TABLE(meal_plan_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR ((SELECT auth.uid()) <> p_user_id AND NOT (SELECT public.get_is_admin()))
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
SET search_path = pg_catalog, public, private
AS $$
  SELECT * FROM private.get_current_meal_plan_id(p_user_id);
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
BEGIN
  SELECT origin, user_id INTO plan_origin, plan_user_id
  FROM public.meal_plans
  WHERE id = p_meal_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'meal plan % does not exist', p_meal_plan_id;
  END IF;

  IF (SELECT auth.uid()) IS NULL
    OR ((SELECT auth.uid()) <> p_user_id AND NOT (SELECT public.get_is_admin()))
  THEN
    RAISE EXCEPTION 'not authorized to publish this meal plan'
      USING ERRCODE = '42501';
  END IF;

  IF plan_origin = 'generated' AND plan_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'generated meal plans can only be assigned to their owner';
  END IF;

  IF (SELECT auth.uid()) = p_user_id
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

REVOKE ALL ON FUNCTION private.get_active_nutrition_target(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_current_meal_plan_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.publish_meal_plan(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_nutrition_target(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_meal_plan_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_meal_plan(UUID, UUID) FROM PUBLIC;

-- The private schema is not exposed through the Data API. Authenticated calls
-- reach it only through the SECURITY INVOKER public wrappers above; each
-- private function revalidates auth.uid() before accessing protected rows.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_active_nutrition_target(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_current_meal_plan_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.publish_meal_plan(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_nutrition_target(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_meal_plan_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_meal_plan(UUID, UUID) TO authenticated;

-- Generated rows and assignments are server-owned. Admins retain direct
-- editing only for the legacy/manual authoring path.
DROP POLICY IF EXISTS "Admins manage meal plans" ON public.meal_plans;
CREATE POLICY "Admins manage manual meal plans"
  ON public.meal_plans FOR ALL TO authenticated
  USING ((SELECT public.get_is_admin()) AND origin = 'manual')
  WITH CHECK ((SELECT public.get_is_admin()) AND origin = 'manual');

DROP POLICY IF EXISTS "Users read assigned meal plans" ON public.meal_plans;
CREATE POLICY "Users read own or assigned meal plans"
  ON public.meal_plans FOR SELECT TO authenticated
  USING (
    user_id IS NULL
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_meal_plans ump
      WHERE ump.meal_plan_id = meal_plans.id
        AND ump.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins manage meal plan recipes" ON public.meal_plan_recipes;
CREATE POLICY "Admins manage manual meal plan recipes"
  ON public.meal_plan_recipes FOR ALL TO authenticated
  USING (
    (SELECT public.get_is_admin())
    AND EXISTS (
      SELECT 1 FROM public.meal_plans mp
      WHERE mp.id = meal_plan_recipes.meal_plan_id AND mp.origin = 'manual'
    )
  )
  WITH CHECK (
    (SELECT public.get_is_admin())
    AND EXISTS (
      SELECT 1 FROM public.meal_plans mp
      WHERE mp.id = meal_plan_recipes.meal_plan_id AND mp.origin = 'manual'
    )
  );

DROP POLICY IF EXISTS "Users read meal plan recipes for accessible plans" ON public.meal_plan_recipes;
CREATE POLICY "Users read meal-plan recipes for accessible plans"
  ON public.meal_plan_recipes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meal_plans mp
      WHERE mp.id = meal_plan_recipes.meal_plan_id
        AND (
          mp.user_id IS NULL
          OR mp.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.user_meal_plans ump
            WHERE ump.meal_plan_id = mp.id
              AND ump.user_id = (SELECT auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Admins manage assignments" ON public.user_meal_plans;
CREATE POLICY "Admins read all meal-plan assignments"
  ON public.user_meal_plans FOR SELECT TO authenticated
  USING ((SELECT public.get_is_admin()));

CREATE POLICY "Admins insert manual meal-plan assignments"
  ON public.user_meal_plans FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_is_admin())
    AND EXISTS (
      SELECT 1 FROM public.meal_plans mp
      WHERE mp.id = user_meal_plans.meal_plan_id AND mp.origin = 'manual'
    )
  );

CREATE POLICY "Admins update manual meal-plan assignments"
  ON public.user_meal_plans FOR UPDATE TO authenticated
  USING (
    (SELECT public.get_is_admin())
    AND EXISTS (
      SELECT 1 FROM public.meal_plans mp
      WHERE mp.id = user_meal_plans.meal_plan_id AND mp.origin = 'manual'
    )
  )
  WITH CHECK (
    (SELECT public.get_is_admin())
    AND EXISTS (
      SELECT 1 FROM public.meal_plans mp
      WHERE mp.id = user_meal_plans.meal_plan_id AND mp.origin = 'manual'
    )
  );

CREATE POLICY "Admins delete manual meal-plan assignments"
  ON public.user_meal_plans FOR DELETE TO authenticated
  USING (
    (SELECT public.get_is_admin())
    AND EXISTS (
      SELECT 1 FROM public.meal_plans mp
      WHERE mp.id = user_meal_plans.meal_plan_id AND mp.origin = 'manual'
    )
  );
