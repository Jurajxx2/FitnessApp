-- Reject stale or malformed generated-plan inputs before creating each meal,
-- so every requested recipe is materialized or the save fails atomically.
CREATE OR REPLACE FUNCTION private.admin_save_generated_meal_plan(
  p_plan_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_target_id UUID,
  p_days JSONB,
  p_score REAL,
  p_diagnostics JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved_plan_id UUID := p_plan_id;
  target_version_value INTEGER;
  day_record RECORD;
  meal_record RECORD;
  requested_recipe RECORD;
  recipe_record RECORD;
  saved_meal_id UUID;
  snack_day_count INTEGER;
BEGIN
  IF NOT private.get_is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'meal-plan name is required' USING ERRCODE = '22023';
  END IF;
  -- Validate the complete seven-day payload before mutating a draft. Keeping
  -- this strict prevents silently accepting null, duplicate, or extra slots.
  IF p_days IS NULL OR jsonb_typeof(p_days) <> 'array' THEN
    RAISE EXCEPTION 'days must be a non-null JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_days) <> 7 THEN
    RAISE EXCEPTION 'days must contain exactly seven entries' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_days) AS day_item(value)
    WHERE jsonb_typeof(day_item.value) <> 'object'
  ) THEN
    RAISE EXCEPTION 'every day must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_days) AS day_item(value)
    WHERE NOT (day_item.value ? 'day_of_week')
       OR NOT (day_item.value ? 'meals')
       OR (SELECT count(*) FROM jsonb_object_keys(day_item.value)) <> 2
       OR jsonb_typeof(day_item.value -> 'day_of_week') <> 'number'
       OR (day_item.value ->> 'day_of_week') !~ '^[0-6]$'
       OR jsonb_typeof(day_item.value -> 'meals') <> 'array'
  ) THEN
    RAISE EXCEPTION 'each day must contain only day_of_week (0..6) and meals'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_days) AS day_item(value)
    WHERE jsonb_array_length(day_item.value -> 'meals') NOT IN (3, 4)
  ) THEN
    RAISE EXCEPTION 'each day must contain three or four meals' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT (day_item.value ->> 'day_of_week')::INTEGER)
      FROM jsonb_array_elements(p_days) AS day_item(value)) <> 7 THEN
    RAISE EXCEPTION 'days must uniquely cover day_of_week 0 through 6'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_days) AS day_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(day_item.value -> 'meals') AS meal_item(value)
    WHERE jsonb_typeof(meal_item.value) <> 'object'
  ) THEN
    RAISE EXCEPTION 'every meal must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_days) AS day_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(day_item.value -> 'meals') AS meal_item(value)
    WHERE NOT (meal_item.value ? 'meal_type')
       OR NOT (meal_item.value ? 'recipes')
       OR (SELECT count(*) FROM jsonb_object_keys(meal_item.value)) <> 2
       OR jsonb_typeof(meal_item.value -> 'meal_type') <> 'string'
       OR (meal_item.value ->> 'meal_type') NOT IN ('breakfast', 'lunch', 'dinner', 'snack')
       OR jsonb_typeof(meal_item.value -> 'recipes') <> 'array'
  ) THEN
    RAISE EXCEPTION 'each meal must contain only a supported meal_type and recipes'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_days) AS day_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(day_item.value -> 'meals') AS meal_item(value)
    WHERE jsonb_array_length(meal_item.value -> 'recipes') <> 1
  ) THEN
    RAISE EXCEPTION 'each meal must contain exactly one recipe' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_days) AS day_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(day_item.value -> 'meals') AS meal_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(meal_item.value -> 'recipes') AS recipe_item(value)
    WHERE jsonb_typeof(recipe_item.value) <> 'object'
  ) THEN
    RAISE EXCEPTION 'every recipe entry must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_days) AS day_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(day_item.value -> 'meals') AS meal_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(meal_item.value -> 'recipes') AS recipe_item(value)
    WHERE NOT (recipe_item.value ? 'recipe_id')
       OR NOT (recipe_item.value ? 'portion_multiplier')
       OR NOT (recipe_item.value ? 'snapshot_recipe_name')
       OR NOT (recipe_item.value ? 'snapshot_calories')
       OR NOT (recipe_item.value ? 'snapshot_protein_g')
       OR NOT (recipe_item.value ? 'snapshot_carbs_g')
       OR NOT (recipe_item.value ? 'snapshot_fat_g')
       OR NOT (recipe_item.value ? 'snapshot_fiber_g')
       OR (SELECT count(*) FROM jsonb_object_keys(recipe_item.value)) <> 8
       OR jsonb_typeof(recipe_item.value -> 'recipe_id') <> 'string'
       OR jsonb_typeof(recipe_item.value -> 'portion_multiplier') <> 'number'
       OR jsonb_typeof(recipe_item.value -> 'snapshot_recipe_name') <> 'string'
       OR jsonb_typeof(recipe_item.value -> 'snapshot_calories') <> 'number'
       OR jsonb_typeof(recipe_item.value -> 'snapshot_protein_g') <> 'number'
       OR jsonb_typeof(recipe_item.value -> 'snapshot_carbs_g') <> 'number'
       OR jsonb_typeof(recipe_item.value -> 'snapshot_fat_g') <> 'number'
       OR jsonb_typeof(recipe_item.value -> 'snapshot_fiber_g') NOT IN ('number', 'null')
  ) THEN
    RAISE EXCEPTION 'each recipe entry must contain its id, portion, and complete expected snapshot'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_days) AS day_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(day_item.value -> 'meals') AS meal_item(value)
    GROUP BY (day_item.value ->> 'day_of_week')::INTEGER
    HAVING count(*) FILTER (WHERE meal_item.value ->> 'meal_type' = 'breakfast') <> 1
        OR count(*) FILTER (WHERE meal_item.value ->> 'meal_type' = 'lunch') <> 1
        OR count(*) FILTER (WHERE meal_item.value ->> 'meal_type' = 'dinner') <> 1
        OR count(*) FILTER (WHERE meal_item.value ->> 'meal_type' = 'snack') NOT IN (0, 1)
  ) THEN
    RAISE EXCEPTION 'each day must have breakfast, lunch, dinner, and at most one snack'
      USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO snack_day_count
  FROM (
    SELECT (day_item.value ->> 'day_of_week')::INTEGER
    FROM jsonb_array_elements(p_days) AS day_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(day_item.value -> 'meals') AS meal_item(value)
    GROUP BY (day_item.value ->> 'day_of_week')::INTEGER
    HAVING count(*) FILTER (WHERE meal_item.value ->> 'meal_type' = 'snack') = 1
  ) AS snack_days;
  IF snack_day_count NOT IN (0, 7) THEN
    RAISE EXCEPTION 'snacks must be present on every day or on no days'
      USING ERRCODE = '22023';
  END IF;

  SELECT version INTO target_version_value
  FROM public.nutrition_targets
  WHERE id = p_target_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'nutrition target % does not belong to user %', p_target_id, p_user_id
      USING ERRCODE = '22023';
  END IF;

  IF saved_plan_id IS NULL THEN
    INSERT INTO public.meal_plans (
      coach_id, user_id, name, description, is_active, origin, generation_status,
      nutrition_target_id, target_version, algorithm_version, score, diagnostics, generated_at
    ) VALUES (
      (SELECT auth.uid()), p_user_id, btrim(p_name), NULLIF(btrim(p_description), ''),
      true, 'generated', 'draft', p_target_id, target_version_value, 'v1', p_score, p_diagnostics, now()
    )
    RETURNING id INTO saved_plan_id;
  ELSE
    UPDATE public.meal_plans
    SET name = btrim(p_name),
        description = NULLIF(btrim(p_description), ''),
        nutrition_target_id = p_target_id,
        target_version = target_version_value,
        score = p_score,
        diagnostics = p_diagnostics,
        generated_at = now(),
        updated_at = now()
    WHERE id = saved_plan_id
      AND origin = 'generated'
      AND generation_status = 'draft'
      AND user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'generated draft plan % does not exist for this user', saved_plan_id
        USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM public.meal_plan_recipes WHERE meal_plan_id = saved_plan_id;
    DELETE FROM public.meals WHERE meal_plan_id = saved_plan_id;
  END IF;

  FOR day_record IN
    SELECT day.day_of_week, day.meals
    FROM jsonb_to_recordset(COALESCE(p_days, '[]'::jsonb)) AS day(day_of_week INTEGER, meals JSONB)
  LOOP
    IF day_record.day_of_week NOT BETWEEN 0 AND 6
      OR jsonb_typeof(COALESCE(day_record.meals, '[]'::jsonb)) <> 'array'
    THEN
      RAISE EXCEPTION 'plan contains an invalid day' USING ERRCODE = '22023';
    END IF;

    FOR meal_record IN
      SELECT meal.meal_type, meal.recipes
      FROM jsonb_to_recordset(day_record.meals) AS meal(meal_type TEXT, recipes JSONB)
    LOOP
      IF meal_record.meal_type NOT IN ('breakfast', 'lunch', 'dinner', 'snack')
        OR jsonb_typeof(COALESCE(meal_record.recipes, '[]'::jsonb)) <> 'array'
      THEN
        RAISE EXCEPTION 'plan contains an invalid meal' USING ERRCODE = '22023';
      END IF;

      -- Lock and validate every requested recipe before materializing this meal.
      FOR requested_recipe IN
        SELECT entry.recipe_id, entry.portion_multiplier, entry.snapshot_recipe_name,
               entry.snapshot_calories, entry.snapshot_protein_g, entry.snapshot_carbs_g,
               entry.snapshot_fat_g, entry.snapshot_fiber_g
        FROM jsonb_to_recordset(meal_record.recipes)
          AS entry(
            recipe_id UUID, portion_multiplier NUMERIC, snapshot_recipe_name TEXT,
            snapshot_calories DOUBLE PRECISION, snapshot_protein_g DOUBLE PRECISION,
            snapshot_carbs_g DOUBLE PRECISION, snapshot_fat_g DOUBLE PRECISION,
            snapshot_fiber_g DOUBLE PRECISION
          )
      LOOP
        IF requested_recipe.recipe_id IS NULL THEN
          RAISE EXCEPTION 'recipe id is required' USING ERRCODE = '22023';
        END IF;
        IF requested_recipe.portion_multiplier IS NULL OR requested_recipe.portion_multiplier <= 0 THEN
          RAISE EXCEPTION 'portion multiplier must be positive' USING ERRCODE = '22023';
        END IF;
        IF requested_recipe.portion_multiplier::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR requested_recipe.snapshot_calories::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR requested_recipe.snapshot_protein_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR requested_recipe.snapshot_carbs_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR requested_recipe.snapshot_fat_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR requested_recipe.snapshot_fiber_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
        THEN
          RAISE EXCEPTION 'recipe portion and snapshot values must be finite'
            USING ERRCODE = '22023';
        END IF;

        SELECT recipe.name, recipe.calories, recipe.protein_g, recipe.carbs_g,
               recipe.fat_g, recipe.fiber_g, recipe.is_active,
               recipe.eligible_for_generator, recipe.macros_verified,
               recipe.meal_types, recipe.is_scalable, recipe.allowed_portions
        INTO recipe_record
        FROM public.recipes recipe
        WHERE recipe.id = requested_recipe.recipe_id
        FOR SHARE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'recipe % does not exist', requested_recipe.recipe_id
            USING ERRCODE = '22023';
        END IF;
        IF recipe_record.is_active IS NOT TRUE THEN
          RAISE EXCEPTION 'recipe % is inactive', requested_recipe.recipe_id
            USING ERRCODE = '22023';
        END IF;
        IF recipe_record.eligible_for_generator IS NOT TRUE THEN
          RAISE EXCEPTION 'recipe % is not eligible for the generator', requested_recipe.recipe_id
            USING ERRCODE = '22023';
        END IF;
        IF recipe_record.macros_verified IS NOT TRUE THEN
          RAISE EXCEPTION 'recipe % has unverified macros', requested_recipe.recipe_id
            USING ERRCODE = '22023';
        END IF;
        IF recipe_record.calories::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR recipe_record.protein_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR recipe_record.carbs_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR recipe_record.fat_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR recipe_record.fiber_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
        THEN
          RAISE EXCEPTION 'recipe % contains non-finite macros', requested_recipe.recipe_id
            USING ERRCODE = '22023';
        END IF;
        IF requested_recipe.snapshot_recipe_name IS DISTINCT FROM recipe_record.name
          OR abs(requested_recipe.snapshot_calories - recipe_record.calories * requested_recipe.portion_multiplier) > 0.001
          OR abs(requested_recipe.snapshot_protein_g - recipe_record.protein_g * requested_recipe.portion_multiplier) > 0.001
          OR abs(requested_recipe.snapshot_carbs_g - recipe_record.carbs_g * requested_recipe.portion_multiplier) > 0.001
          OR abs(requested_recipe.snapshot_fat_g - recipe_record.fat_g * requested_recipe.portion_multiplier) > 0.001
          OR (requested_recipe.snapshot_fiber_g IS NULL) <> (recipe_record.fiber_g IS NULL)
          OR (
            requested_recipe.snapshot_fiber_g IS NOT NULL
            AND abs(requested_recipe.snapshot_fiber_g - recipe_record.fiber_g * requested_recipe.portion_multiplier) > 0.001
          )
        THEN
          RAISE EXCEPTION 'recipe % changed after generation; regenerate before saving',
            requested_recipe.recipe_id USING ERRCODE = '55000';
        END IF;
        IF NOT (meal_record.meal_type = ANY(COALESCE(recipe_record.meal_types, ARRAY[]::TEXT[]))) THEN
          RAISE EXCEPTION 'recipe % is not allowed for meal type %',
            requested_recipe.recipe_id, meal_record.meal_type
            USING ERRCODE = '22023';
        END IF;

        -- Match the generator's portion contract exactly. Explicit portions
        -- take precedence over the scalable/rigid fallback behavior.
        IF EXISTS (
          SELECT 1
          FROM unnest(COALESCE(recipe_record.allowed_portions, ARRAY[]::NUMERIC[])) AS portion(value)
          WHERE portion.value IS NULL
            OR portion.value <= 0
            OR portion.value::TEXT IN ('NaN', 'Infinity', '-Infinity')
        ) THEN
          RAISE EXCEPTION 'recipe % contains invalid allowed portions', requested_recipe.recipe_id
            USING ERRCODE = '22023';
        END IF;
        IF cardinality(COALESCE(recipe_record.allowed_portions, ARRAY[]::NUMERIC[])) > 0 THEN
          IF NOT (requested_recipe.portion_multiplier = ANY(recipe_record.allowed_portions)) THEN
            RAISE EXCEPTION 'portion multiplier % is not allowed for recipe %',
              requested_recipe.portion_multiplier, requested_recipe.recipe_id
              USING ERRCODE = '22023';
          END IF;
        ELSIF recipe_record.is_scalable IS TRUE THEN
          IF requested_recipe.portion_multiplier NOT BETWEEN 0.5 AND 2.0
            OR mod(requested_recipe.portion_multiplier - 0.5, 0.25) <> 0
          THEN
            RAISE EXCEPTION 'scalable recipe % requires a 0.25-step portion between 0.5 and 2.0',
              requested_recipe.recipe_id USING ERRCODE = '22023';
          END IF;
        ELSIF requested_recipe.portion_multiplier <> 1 THEN
          RAISE EXCEPTION 'rigid recipe % requires a portion multiplier of 1',
            requested_recipe.recipe_id USING ERRCODE = '22023';
        END IF;
      END LOOP;

      INSERT INTO public.meals (meal_plan_id, name, day_of_week, time_of_day, sort_order)
      VALUES (
        saved_plan_id,
        upper(meal_record.meal_type),
        day_record.day_of_week,
        CASE meal_record.meal_type
          WHEN 'breakfast' THEN '08:00' WHEN 'lunch' THEN '12:30'
          WHEN 'dinner' THEN '19:00' ELSE '16:00'
        END,
        day_record.day_of_week * 4 + CASE meal_record.meal_type
          WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'dinner' THEN 2 ELSE 3 END
      )
      RETURNING id INTO saved_meal_id;

      FOR recipe_record IN
        SELECT recipe.id, recipe.name, recipe.calories, recipe.protein_g, recipe.carbs_g,
               recipe.fat_g, recipe.fiber_g,
               entry.portion_multiplier,
               entry.ordinality::INTEGER - 1 AS sort_order
        FROM ROWS FROM (
          jsonb_to_recordset(meal_record.recipes) AS (recipe_id UUID, portion_multiplier NUMERIC)
        ) WITH ORDINALITY AS entry(recipe_id, portion_multiplier, ordinality)
        JOIN public.recipes recipe ON recipe.id = entry.recipe_id
        ORDER BY entry.ordinality
      LOOP
        INSERT INTO public.meal_plan_recipes (
          meal_plan_id, meal_id, recipe_id, meal_type, day_of_week,
          slot_kind, portion_multiplier, sort_order, snapshot_recipe_name,
          snapshot_calories, snapshot_protein_g, snapshot_carbs_g, snapshot_fat_g, snapshot_fiber_g
        ) VALUES (
          saved_plan_id, saved_meal_id, recipe_record.id,
          meal_record.meal_type, day_record.day_of_week,
          'recipe', recipe_record.portion_multiplier, recipe_record.sort_order, recipe_record.name,
          recipe_record.calories * recipe_record.portion_multiplier,
          recipe_record.protein_g * recipe_record.portion_multiplier,
          recipe_record.carbs_g * recipe_record.portion_multiplier,
          recipe_record.fat_g * recipe_record.portion_multiplier,
          recipe_record.fiber_g * recipe_record.portion_multiplier
        );

        INSERT INTO public.meal_foods (meal_id, name, amount_grams, calories, protein_g, carbs_g, fat_g)
        VALUES (
          saved_meal_id, recipe_record.name,
          round(100 * recipe_record.portion_multiplier),
          recipe_record.calories * recipe_record.portion_multiplier,
          recipe_record.protein_g * recipe_record.portion_multiplier,
          recipe_record.carbs_g * recipe_record.portion_multiplier,
          recipe_record.fat_g * recipe_record.portion_multiplier
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN saved_plan_id;
END;
$$;

-- Serialize preference mutations even when the athlete does not yet have a
-- preferences row. Publication takes the same namespace-2 advisory key before
-- reading, so a first insert cannot race the generated-plan checks.
CREATE OR REPLACE FUNCTION private.serialize_nutrition_preference_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_lock_key BIGINT;
  new_lock_key BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(NEW.user_id::TEXT, 2)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(OLD.user_id::TEXT, 2)
    );
    RETURN OLD;
  END IF;

  old_lock_key := pg_catalog.hashtextextended(OLD.user_id::TEXT, 2);
  new_lock_key := pg_catalog.hashtextextended(NEW.user_id::TEXT, 2);
  IF old_lock_key <= new_lock_key THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(old_lock_key);
    IF new_lock_key <> old_lock_key THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(new_lock_key);
    END IF;
  ELSE
    PERFORM pg_catalog.pg_advisory_xact_lock(new_lock_key);
    PERFORM pg_catalog.pg_advisory_xact_lock(old_lock_key);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.serialize_nutrition_preference_writes()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS serialize_nutrition_preference_writes
  ON public.user_nutrition_preferences;
CREATE TRIGGER serialize_nutrition_preference_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_nutrition_preferences
  FOR EACH ROW EXECUTE FUNCTION private.serialize_nutrition_preference_writes();

-- Serialize assignment changes per athlete and refuse to publish a generated
-- draft unless its persisted rows still satisfy the generator contract.
-- Manual plans retain the existing publication and authorization behavior.
CREATE OR REPLACE FUNCTION private.publish_meal_plan(p_user_id UUID, p_meal_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  plan_origin TEXT;
  plan_user_id UUID;
  plan_generation_status TEXT;
  plan_target_id UUID;
  active_target RECORD;
  persisted_meal_count INTEGER;
  persisted_recipe_count INTEGER;
  persisted_snack_day_count INTEGER;
  preference_dietary_patterns TEXT[];
  preference_excluded_allergens TEXT[];
  preference_disliked_recipe_ids UUID[];
  preference_include_snack BOOLEAN;
  preference_max_prep_time_min INTEGER;
  preference_max_recipe_repeats INTEGER;
  is_server_call BOOLEAN := (SELECT auth.role()) = 'service_role';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id is required' USING ERRCODE = '22023';
  END IF;
  IF NOT is_server_call AND (
    (SELECT auth.uid()) IS NULL
    OR ((SELECT auth.uid()) <> p_user_id AND NOT (SELECT public.get_is_admin()))
  ) THEN
    RAISE EXCEPTION 'not authorized to publish this meal plan'
      USING ERRCODE = '42501';
  END IF;

  -- Acquire target, assignment, and preference locks in the fixed namespace
  -- order used by their writers. Namespace 0 closes the target-change race.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 1));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 2));

  SELECT origin, user_id, generation_status, nutrition_target_id
  INTO plan_origin, plan_user_id, plan_generation_status, plan_target_id
  FROM public.meal_plans
  WHERE id = p_meal_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'meal plan % does not exist', p_meal_plan_id
      USING ERRCODE = 'P0002';
  END IF;

  IF plan_origin = 'generated' AND plan_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'generated meal plans can only be assigned to their owner'
      USING ERRCODE = '22023';
  END IF;

  IF NOT is_server_call
    AND (SELECT auth.uid()) = p_user_id
    AND (plan_origin <> 'generated' OR plan_user_id IS DISTINCT FROM p_user_id)
  THEN
    RAISE EXCEPTION 'users may only publish their own generated meal-plan draft'
      USING ERRCODE = '42501';
  END IF;

  IF plan_origin = 'generated' THEN
    IF plan_generation_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'generated meal plan % must be a draft before publication', p_meal_plan_id
        USING ERRCODE = '55000';
    END IF;

    -- Resolve with the same deterministic precedence as
    -- private.get_active_nutrition_target, and lock the chosen target against
    -- being closed while publication is validated.
    SELECT nt.id, nt.calories, nt.protein_g, nt.carbs_g, nt.fat_g,
           nt.calorie_tol_pct, nt.protein_tol_pct, nt.carbs_tol_pct, nt.fat_tol_pct
    INTO active_target
    FROM public.nutrition_targets nt
    WHERE nt.user_id = p_user_id
      AND nt.effective_to IS NULL
    ORDER BY
      CASE
        WHEN nt.source = 'admin' AND nt.is_locked THEN 0
        WHEN nt.source = 'admin' THEN 1
        WHEN nt.source = 'user' THEN 2
        ELSE 3
      END,
      nt.version DESC
    LIMIT 1
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'user % has no active nutrition target', p_user_id
        USING ERRCODE = '55000';
    END IF;
    IF plan_target_id IS DISTINCT FROM active_target.id THEN
      RAISE EXCEPTION 'generated meal plan % targets stale nutrition target % (current target is %)',
        p_meal_plan_id, plan_target_id, active_target.id
        USING ERRCODE = '55000';
    END IF;
    IF active_target.calories::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR active_target.protein_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR active_target.carbs_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR active_target.fat_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR active_target.calorie_tol_pct::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR active_target.protein_tol_pct::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR active_target.carbs_tol_pct::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR active_target.fat_tol_pct::TEXT IN ('NaN', 'Infinity', '-Infinity')
    THEN
      RAISE EXCEPTION 'active nutrition target % contains non-finite values', active_target.id
        USING ERRCODE = '22023';
    END IF;

    -- The namespace-2 lock serializes this read with the mutation trigger,
    -- including a first insert. Avoid a row lock here because PostgreSQL may
    -- acquire an UPDATE row lock before its BEFORE ROW trigger runs.
    SELECT COALESCE(preference.dietary_patterns, '{}'::TEXT[]),
           COALESCE(preference.excluded_allergens, '{}'::TEXT[]),
           COALESCE(preference.disliked_recipe_ids, '{}'::UUID[]),
           COALESCE(preference.include_snack, false),
           preference.max_prep_time_min,
           COALESCE(preference.max_recipe_repeats_per_week, 2)
    INTO preference_dietary_patterns, preference_excluded_allergens,
         preference_disliked_recipe_ids, preference_include_snack,
         preference_max_prep_time_min, preference_max_recipe_repeats
    FROM public.user_nutrition_preferences preference
    WHERE preference.user_id = p_user_id;

    IF NOT FOUND THEN
      preference_dietary_patterns := '{}'::TEXT[];
      preference_excluded_allergens := '{}'::TEXT[];
      preference_disliked_recipe_ids := '{}'::UUID[];
      preference_include_snack := false;
      preference_max_prep_time_min := NULL;
      preference_max_recipe_repeats := 2;
    END IF;

    -- Lock existing child rows so normal RPC writers cannot change the
    -- persisted plan between validation and assignment.
    PERFORM meal.id
    FROM public.meals meal
    WHERE meal.meal_plan_id = p_meal_plan_id
    FOR SHARE OF meal;

    PERFORM mpr.id
    FROM public.meal_plan_recipes mpr
    WHERE mpr.meal_plan_id = p_meal_plan_id
    FOR SHARE OF mpr;

    SELECT count(*) INTO persisted_meal_count
    FROM public.meals meal
    WHERE meal.meal_plan_id = p_meal_plan_id;

    IF persisted_meal_count NOT IN (21, 28) THEN
      RAISE EXCEPTION 'generated meal plan % must contain 21 or 28 meal slots', p_meal_plan_id
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.meals meal
      WHERE meal.meal_plan_id = p_meal_plan_id
        AND (
          meal.day_of_week IS NULL
          OR meal.day_of_week NOT BETWEEN 0 AND 6
          OR lower(meal.name) NOT IN ('breakfast', 'lunch', 'dinner', 'snack')
        )
    ) THEN
      RAISE EXCEPTION 'generated meal plan % contains an invalid persisted meal', p_meal_plan_id
        USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(DISTINCT meal.day_of_week)
        FROM public.meals meal
        WHERE meal.meal_plan_id = p_meal_plan_id) <> 7 THEN
      RAISE EXCEPTION 'generated meal plan % must cover seven unique days', p_meal_plan_id
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.meals meal
      WHERE meal.meal_plan_id = p_meal_plan_id
      GROUP BY meal.day_of_week
      HAVING count(*) FILTER (WHERE lower(meal.name) = 'breakfast') <> 1
          OR count(*) FILTER (WHERE lower(meal.name) = 'lunch') <> 1
          OR count(*) FILTER (WHERE lower(meal.name) = 'dinner') <> 1
          OR count(*) FILTER (WHERE lower(meal.name) = 'snack') NOT IN (0, 1)
    ) THEN
      RAISE EXCEPTION 'generated meal plan % has incomplete or duplicate meal slots', p_meal_plan_id
        USING ERRCODE = '22023';
    END IF;

    SELECT count(*) INTO persisted_snack_day_count
    FROM (
      SELECT meal.day_of_week
      FROM public.meals meal
      WHERE meal.meal_plan_id = p_meal_plan_id
      GROUP BY meal.day_of_week
      HAVING count(*) FILTER (WHERE lower(meal.name) = 'snack') = 1
    ) AS snack_days;
    IF persisted_snack_day_count NOT IN (0, 7) THEN
      RAISE EXCEPTION 'generated meal plan % must include snacks on every day or no days', p_meal_plan_id
        USING ERRCODE = '22023';
    END IF;
    IF persisted_snack_day_count <> (CASE WHEN preference_include_snack THEN 7 ELSE 0 END) THEN
      RAISE EXCEPTION 'generated meal plan % no longer matches the current snack preference', p_meal_plan_id
        USING ERRCODE = '55000';
    END IF;

    SELECT count(*) INTO persisted_recipe_count
    FROM public.meal_plan_recipes mpr
    WHERE mpr.meal_plan_id = p_meal_plan_id;

    IF persisted_recipe_count <> persisted_meal_count THEN
      RAISE EXCEPTION 'generated meal plan % must contain exactly one recipe per meal slot', p_meal_plan_id
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.meal_plan_recipes mpr
      LEFT JOIN public.meals meal
        ON meal.id = mpr.meal_id
       AND meal.meal_plan_id = p_meal_plan_id
      WHERE mpr.meal_plan_id = p_meal_plan_id
        AND (
          meal.id IS NULL
          OR mpr.slot_kind <> 'recipe'
          OR mpr.recipe_id IS NULL
          OR mpr.day_of_week IS DISTINCT FROM meal.day_of_week
          OR mpr.meal_type IS DISTINCT FROM lower(meal.name)
          OR mpr.snapshot_calories IS NULL
          OR mpr.snapshot_protein_g IS NULL
          OR mpr.snapshot_carbs_g IS NULL
          OR mpr.snapshot_fat_g IS NULL
          OR mpr.portion_multiplier::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR mpr.snapshot_calories::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR mpr.snapshot_protein_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR mpr.snapshot_carbs_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR mpr.snapshot_fat_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR mpr.snapshot_fiber_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
        )
    ) THEN
      RAISE EXCEPTION 'generated meal plan % contains an invalid persisted recipe slot', p_meal_plan_id
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.meals meal
      LEFT JOIN public.meal_plan_recipes mpr
        ON mpr.meal_id = meal.id
       AND mpr.meal_plan_id = p_meal_plan_id
      WHERE meal.meal_plan_id = p_meal_plan_id
      GROUP BY meal.id
      HAVING count(mpr.id) <> 1
    ) THEN
      RAISE EXCEPTION 'generated meal plan % must contain exactly one recipe per meal slot', p_meal_plan_id
        USING ERRCODE = '22023';
    END IF;

    -- Lock every referenced current recipe, then re-check all hard generator
    -- eligibility and athlete-preference filters against those locked rows.
    PERFORM recipe.id
    FROM public.meal_plan_recipes mpr
    JOIN public.recipes recipe ON recipe.id = mpr.recipe_id
    WHERE mpr.meal_plan_id = p_meal_plan_id
    FOR SHARE OF recipe;

    IF EXISTS (
      SELECT 1
      FROM public.meal_plan_recipes mpr
      JOIN public.recipes recipe ON recipe.id = mpr.recipe_id
      WHERE mpr.meal_plan_id = p_meal_plan_id
        AND (
          recipe.is_active IS NOT TRUE
          OR recipe.eligible_for_generator IS NOT TRUE
          OR recipe.macros_verified IS NOT TRUE
          OR recipe.calories::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR recipe.protein_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR recipe.carbs_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR recipe.fat_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR recipe.fiber_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
          OR EXISTS (
            SELECT 1
            FROM unnest(COALESCE(recipe.allowed_portions, '{}'::NUMERIC[])) AS portion(value)
            WHERE portion.value IS NULL
              OR portion.value <= 0
              OR portion.value::TEXT IN ('NaN', 'Infinity', '-Infinity')
          )
          OR NOT (mpr.meal_type = ANY(COALESCE(recipe.meal_types, '{}'::TEXT[])))
          OR recipe.id = ANY(preference_disliked_recipe_ids)
          OR COALESCE(recipe.allergens, '{}'::TEXT[]) && preference_excluded_allergens
          OR NOT (COALESCE(recipe.dietary_patterns, '{}'::TEXT[]) @> preference_dietary_patterns)
          OR (
            preference_max_prep_time_min IS NOT NULL
            AND COALESCE(recipe.prep_time_min, 0) + COALESCE(recipe.cook_time_min, 0)
                > preference_max_prep_time_min
          )
          OR (
            cardinality(COALESCE(recipe.allowed_portions, '{}'::NUMERIC[])) > 0
            AND NOT (mpr.portion_multiplier = ANY(recipe.allowed_portions))
          )
          OR (
            cardinality(COALESCE(recipe.allowed_portions, '{}'::NUMERIC[])) = 0
            AND recipe.is_scalable IS TRUE
            AND (
              mpr.portion_multiplier NOT BETWEEN 0.5 AND 2.0
              OR mod(mpr.portion_multiplier - 0.5, 0.25) <> 0
            )
          )
          OR (
            cardinality(COALESCE(recipe.allowed_portions, '{}'::NUMERIC[])) = 0
            AND recipe.is_scalable IS NOT TRUE
            AND mpr.portion_multiplier <> 1
          )
          OR mpr.snapshot_recipe_name IS DISTINCT FROM recipe.name
          OR abs(mpr.snapshot_calories - recipe.calories * mpr.portion_multiplier) > 0.001
          OR abs(mpr.snapshot_protein_g - recipe.protein_g * mpr.portion_multiplier) > 0.001
          OR abs(mpr.snapshot_carbs_g - recipe.carbs_g * mpr.portion_multiplier) > 0.001
          OR abs(mpr.snapshot_fat_g - recipe.fat_g * mpr.portion_multiplier) > 0.001
          OR (mpr.snapshot_fiber_g IS NULL) <> (recipe.fiber_g IS NULL)
          OR (
            mpr.snapshot_fiber_g IS NOT NULL
            AND abs(mpr.snapshot_fiber_g - recipe.fiber_g * mpr.portion_multiplier) > 0.001
          )
        )
    ) THEN
      RAISE EXCEPTION 'generated meal plan % conflicts with current recipes or athlete preferences',
        p_meal_plan_id USING ERRCODE = '55000';
    END IF;

    IF preference_max_recipe_repeats > 0 AND EXISTS (
      SELECT 1
      FROM public.meal_plan_recipes mpr
      WHERE mpr.meal_plan_id = p_meal_plan_id
      GROUP BY mpr.recipe_id
      HAVING count(*) > preference_max_recipe_repeats
    ) THEN
      RAISE EXCEPTION 'generated meal plan % exceeds the current weekly recipe-repeat limit',
        p_meal_plan_id USING ERRCODE = '55000';
    END IF;

    -- The stored snapshots, not mutable recipe rows, are the publication
    -- contract. A zero macro target naturally requires an exact zero total.
    IF EXISTS (
      SELECT 1
      FROM public.meal_plan_recipes mpr
      WHERE mpr.meal_plan_id = p_meal_plan_id
      GROUP BY mpr.day_of_week
      HAVING abs(sum(mpr.snapshot_calories::DOUBLE PRECISION) - active_target.calories::DOUBLE PRECISION)
               > abs(active_target.calories::DOUBLE PRECISION) * active_target.calorie_tol_pct::DOUBLE PRECISION / 100
          OR abs(sum(mpr.snapshot_protein_g::DOUBLE PRECISION) - active_target.protein_g::DOUBLE PRECISION)
               > abs(active_target.protein_g::DOUBLE PRECISION) * active_target.protein_tol_pct::DOUBLE PRECISION / 100
          OR abs(sum(mpr.snapshot_carbs_g::DOUBLE PRECISION) - active_target.carbs_g::DOUBLE PRECISION)
               > abs(active_target.carbs_g::DOUBLE PRECISION) * active_target.carbs_tol_pct::DOUBLE PRECISION / 100
          OR abs(sum(mpr.snapshot_fat_g::DOUBLE PRECISION) - active_target.fat_g::DOUBLE PRECISION)
               > abs(active_target.fat_g::DOUBLE PRECISION) * active_target.fat_tol_pct::DOUBLE PRECISION / 100
    ) THEN
      RAISE EXCEPTION 'generated meal plan % exceeds its nutrition target tolerances', p_meal_plan_id
        USING ERRCODE = '22023';
    END IF;
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

-- Keep the private generated-plan writer behind its explicit admin check.
REVOKE ALL ON FUNCTION private.admin_save_generated_meal_plan(UUID, UUID, TEXT, TEXT, UUID, JSONB, REAL, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_save_generated_meal_plan(UUID, UUID, TEXT, TEXT, UUID, JSONB, REAL, JSONB) TO authenticated;

-- SECURITY INVOKER public.publish_meal_plan needs both schema visibility and
-- EXECUTE on its private helper, which revalidates caller authorization.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.publish_meal_plan(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_meal_plan(UUID, UUID) TO authenticated;

-- Keep the base manual writer reachable only from its SECURITY DEFINER wrapper,
-- which acquires athlete assignment locks before invoking the legacy body.
REVOKE EXECUTE ON FUNCTION private.admin_save_manual_meal_plan_base(
  UUID, TEXT, TEXT, JSONB, UUID[], UUID[]
) FROM service_role;

-- Fold admin visibility into the established SELECT policies to avoid stacking
-- permissive policies; manual admin write policies remain unchanged.
DROP POLICY IF EXISTS "Admins read all meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users read own or assigned meal plans" ON public.meal_plans;
CREATE POLICY "Users read own or assigned meal plans"
  ON public.meal_plans FOR SELECT TO authenticated
  USING (
    (SELECT public.get_is_admin())
    OR user_id IS NULL
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_meal_plans assignment
      WHERE assignment.meal_plan_id = meal_plans.id
        AND assignment.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins read all meal plan recipes" ON public.meal_plan_recipes;
DROP POLICY IF EXISTS "Users read meal-plan recipes for accessible plans" ON public.meal_plan_recipes;
CREATE POLICY "Users read meal-plan recipes for accessible plans"
  ON public.meal_plan_recipes FOR SELECT TO authenticated
  USING (
    (SELECT public.get_is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.meal_plans plan
      WHERE plan.id = meal_plan_recipes.meal_plan_id
        AND (
          plan.user_id IS NULL
          OR plan.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.user_meal_plans assignment
            WHERE assignment.meal_plan_id = plan.id
              AND assignment.user_id = (SELECT auth.uid())
          )
        )
    )
  );

-- Deleting generated drafts bypasses direct table DELETE policy by design, but
-- remains constrained to admins and never deletes published generated plans.
CREATE OR REPLACE FUNCTION private.admin_delete_generated_meal_plan(p_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_plan_id UUID;
BEGIN
  IF NOT private.get_is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  -- Lock first so a concurrent publication cannot pass validation while this
  -- function is checking the assignment dependency.
  SELECT plan.id INTO deleted_plan_id
  FROM public.meal_plans plan
  WHERE plan.id = p_plan_id
    AND plan.origin = 'generated'
    AND plan.generation_status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'generated draft meal plan % does not exist', p_plan_id
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_meal_plans assignment
    WHERE assignment.meal_plan_id = p_plan_id
      AND assignment.status = 'current'
  ) THEN
    RAISE EXCEPTION 'generated draft meal plan % is currently assigned', p_plan_id
      USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.meal_plans
  WHERE id = p_plan_id
  RETURNING id INTO deleted_plan_id;

  RETURN deleted_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_generated_meal_plan(p_plan_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $$
  SELECT private.admin_delete_generated_meal_plan(p_plan_id);
$$;

REVOKE ALL ON FUNCTION private.admin_delete_generated_meal_plan(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_delete_generated_meal_plan(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_generated_meal_plan(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_generated_meal_plan(UUID) TO authenticated;
