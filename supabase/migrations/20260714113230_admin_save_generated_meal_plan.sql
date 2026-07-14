-- Persist a generated meal plan draft. Mirrors admin_save_manual_meal_plan's
-- materialization (meals + meal_plan_recipes snapshots + meal_foods) but scales
-- every snapshot by portion_multiplier and stamps generation metadata.
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
  recipe_record RECORD;
  saved_meal_id UUID;
BEGIN
  IF NOT private.get_is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'meal-plan name is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_days, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'days must be a JSON array' USING ERRCODE = '22023';
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
        WHERE recipe.is_active AND recipe.eligible_for_generator AND recipe.macros_verified
        ORDER BY entry.ordinality
      LOOP
        IF recipe_record.portion_multiplier IS NULL OR recipe_record.portion_multiplier <= 0 THEN
          RAISE EXCEPTION 'portion multiplier must be positive' USING ERRCODE = '22023';
        END IF;

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

CREATE OR REPLACE FUNCTION public.admin_save_generated_meal_plan(
  p_plan_id UUID, p_user_id UUID, p_name TEXT, p_description TEXT,
  p_target_id UUID, p_days JSONB, p_score REAL, p_diagnostics JSONB
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.admin_save_generated_meal_plan(
    p_plan_id, p_user_id, p_name, p_description, p_target_id, p_days, p_score, p_diagnostics
  );
$$;

REVOKE ALL ON FUNCTION public.admin_save_generated_meal_plan(UUID, UUID, TEXT, TEXT, UUID, JSONB, REAL, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_generated_meal_plan(UUID, UUID, TEXT, TEXT, UUID, JSONB, REAL, JSONB) TO authenticated;
