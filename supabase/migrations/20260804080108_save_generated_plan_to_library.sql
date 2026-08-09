-- Preserve generated portion multipliers when a coach publishes a standalone
-- generated week to the reusable manual-plan library. The existing v1 RPC
-- remains intact for deployed clients; v2 accepts structured recipe entries.
CREATE OR REPLACE FUNCTION private.admin_save_manual_meal_plan_v2(
  p_plan_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_meals JSONB,
  p_preserved_meal_ids UUID[],
  p_assigned_user_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved_plan_id UUID;
  legacy_meals JSONB;
  meal_record RECORD;
  recipe_record RECORD;
  saved_meal_id UUID;
BEGIN
  IF NOT private.get_is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(COALESCE(p_meals, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'meals must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_meals, '[]'::jsonb)) AS meal_item(value)
    WHERE jsonb_typeof(meal_item.value) <> 'object'
      OR NOT (meal_item.value ? 'day_of_week')
      OR NOT (meal_item.value ? 'meal_type')
      OR NOT (meal_item.value ? 'recipes')
      OR (SELECT count(*) FROM jsonb_object_keys(meal_item.value)) <> 3
      OR jsonb_typeof(meal_item.value -> 'day_of_week') <> 'number'
      OR jsonb_typeof(meal_item.value -> 'meal_type') <> 'string'
      OR jsonb_typeof(meal_item.value -> 'recipes') <> 'array'
  ) THEN
    RAISE EXCEPTION 'each meal must contain day_of_week, meal_type, and recipes'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_meals, '[]'::jsonb)) AS meal_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(meal_item.value -> 'recipes') AS recipe_item(value)
    WHERE jsonb_typeof(recipe_item.value) <> 'object'
      OR NOT (recipe_item.value ? 'recipe_id')
      OR NOT (recipe_item.value ? 'portion_multiplier')
      OR (SELECT count(*) FROM jsonb_object_keys(recipe_item.value)) <> 2
      OR jsonb_typeof(recipe_item.value -> 'recipe_id') <> 'string'
      OR jsonb_typeof(recipe_item.value -> 'portion_multiplier') <> 'number'
      OR (recipe_item.value ->> 'portion_multiplier')::NUMERIC <= 0
  ) THEN
    RAISE EXCEPTION 'each recipe must contain a valid id and positive portion multiplier'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_meals, '[]'::jsonb)) AS meal_item(value)
    CROSS JOIN LATERAL jsonb_array_elements(meal_item.value -> 'recipes') AS recipe_item(value)
    LEFT JOIN public.recipes recipe
      ON recipe.id = (recipe_item.value ->> 'recipe_id')::UUID
    WHERE recipe.id IS NULL
  ) THEN
    RAISE EXCEPTION 'meal plan references an unavailable recipe'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'day_of_week', meal_item.value -> 'day_of_week',
        'meal_type', meal_item.value -> 'meal_type',
        'recipes', COALESCE((
          SELECT jsonb_agg(recipe_item.value ->> 'recipe_id' ORDER BY recipe_item.ordinality)
          FROM jsonb_array_elements(meal_item.value -> 'recipes')
            WITH ORDINALITY AS recipe_item(value, ordinality)
        ), '[]'::jsonb)
      )
      ORDER BY meal_item.ordinality
    ),
    '[]'::jsonb
  )
  INTO legacy_meals
  FROM jsonb_array_elements(COALESCE(p_meals, '[]'::jsonb))
    WITH ORDINALITY AS meal_item(value, ordinality);

  -- Reuse the established atomic plan and assignment lifecycle, then replace
  -- its v1 unit portions inside the same transaction.
  saved_plan_id := private.admin_save_manual_meal_plan(
    p_plan_id,
    p_name,
    p_description,
    legacy_meals,
    p_preserved_meal_ids,
    p_assigned_user_ids
  );

  FOR meal_record IN
    SELECT meal.day_of_week, meal.meal_type, meal.recipes
    FROM jsonb_to_recordset(COALESCE(p_meals, '[]'::jsonb)) AS meal(
      day_of_week INTEGER, meal_type TEXT, recipes JSONB
    )
  LOOP
    SELECT meal.id
    INTO saved_meal_id
    FROM public.meals meal
    WHERE meal.meal_plan_id = saved_plan_id
      AND meal.day_of_week = meal_record.day_of_week
      AND lower(meal.name) = meal_record.meal_type;

    IF saved_meal_id IS NULL THEN
      RAISE EXCEPTION 'saved meal slot could not be resolved' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.meal_foods food WHERE food.meal_id = saved_meal_id;

    FOR recipe_record IN
      SELECT recipe.id, recipe.name, recipe.calories, recipe.protein_g,
             recipe.carbs_g, recipe.fat_g, recipe.fiber_g,
             (entry.value ->> 'portion_multiplier')::NUMERIC AS portion_multiplier,
             entry.ordinality::INTEGER - 1 AS sort_order
      FROM jsonb_array_elements(COALESCE(meal_record.recipes, '[]'::jsonb))
        WITH ORDINALITY AS entry(value, ordinality)
      JOIN public.recipes recipe ON recipe.id = (entry.value ->> 'recipe_id')::UUID
      ORDER BY entry.ordinality
    LOOP
      UPDATE public.meal_plan_recipes
      SET portion_multiplier = recipe_record.portion_multiplier,
          snapshot_recipe_name = recipe_record.name,
          snapshot_calories = recipe_record.calories * recipe_record.portion_multiplier,
          snapshot_protein_g = recipe_record.protein_g * recipe_record.portion_multiplier,
          snapshot_carbs_g = recipe_record.carbs_g * recipe_record.portion_multiplier,
          snapshot_fat_g = recipe_record.fat_g * recipe_record.portion_multiplier,
          snapshot_fiber_g = recipe_record.fiber_g * recipe_record.portion_multiplier
      WHERE meal_plan_id = saved_plan_id
        AND meal_id = saved_meal_id
        AND recipe_id = recipe_record.id
        AND sort_order = recipe_record.sort_order;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'saved recipe slot could not be resolved' USING ERRCODE = 'P0002';
      END IF;

      INSERT INTO public.meal_foods (
        meal_id, name, amount_grams, calories, protein_g, carbs_g, fat_g
      ) VALUES (
        saved_meal_id,
        recipe_record.name,
        round(100 * recipe_record.portion_multiplier),
        recipe_record.calories * recipe_record.portion_multiplier,
        recipe_record.protein_g * recipe_record.portion_multiplier,
        recipe_record.carbs_g * recipe_record.portion_multiplier,
        recipe_record.fat_g * recipe_record.portion_multiplier
      );
    END LOOP;
  END LOOP;

  RETURN saved_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_save_manual_meal_plan_v2(
  UUID, TEXT, TEXT, JSONB, UUID[], UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_save_manual_meal_plan_v2(
  UUID, TEXT, TEXT, JSONB, UUID[], UUID[]
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_save_manual_meal_plan_v2(
  p_plan_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_meals JSONB,
  p_preserved_meal_ids UUID[],
  p_assigned_user_ids UUID[]
)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_save_manual_meal_plan_v2(
    p_plan_id,
    p_name,
    p_description,
    p_meals,
    p_preserved_meal_ids,
    p_assigned_user_ids
  )
$$;

REVOKE ALL ON FUNCTION public.admin_save_manual_meal_plan_v2(
  UUID, TEXT, TEXT, JSONB, UUID[], UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_manual_meal_plan_v2(
  UUID, TEXT, TEXT, JSONB, UUID[], UUID[]
) TO authenticated;
