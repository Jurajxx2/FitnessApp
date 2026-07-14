-- Keep legacy clients on their existing RPC signature while correcting the
-- recipe-level macro contract: ingredient values are whole-recipe totals, so
-- the persisted recipe macros must be divided by servings. Generator metadata
-- is deliberately untouched because this signature cannot express it.
CREATE OR REPLACE FUNCTION public.admin_save_recipe(
  p_recipe_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_prep_time_min INTEGER,
  p_cook_time_min INTEGER,
  p_servings INTEGER,
  p_external_id TEXT,
  p_photo_file_name TEXT,
  p_photo_url TEXT,
  p_replace_photo BOOLEAN,
  p_difficulty TEXT,
  p_tags JSONB,
  p_steps JSONB,
  p_is_active BOOLEAN,
  p_featured BOOLEAN,
  p_ingredients JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  saved_recipe_id UUID := p_recipe_id;
  per_serving_calories DOUBLE PRECISION;
  per_serving_protein DOUBLE PRECISION;
  per_serving_carbs DOUBLE PRECISION;
  per_serving_fat DOUBLE PRECISION;
BEGIN
  IF NOT (SELECT public.get_is_admin()) THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'recipe name is required' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_servings, 0) <= 0
    OR COALESCE(p_prep_time_min, 0) < 0
    OR COALESCE(p_cook_time_min, 0) < 0
  THEN
    RAISE EXCEPTION 'recipe time and serving values are invalid' USING ERRCODE = '22023';
  END IF;
  IF p_difficulty IS NOT NULL AND p_difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RAISE EXCEPTION 'recipe difficulty is invalid' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_tags, '[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(p_steps, '[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(p_ingredients, '[]'::jsonb)) <> 'array'
  THEN
    RAISE EXCEPTION 'recipe collections must be JSON arrays' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_ingredients, '[]'::jsonb)) AS ingredient(
      name TEXT, quantity REAL, unit TEXT, calories REAL,
      protein_g REAL, carbs_g REAL, fat_g REAL, sort_order INTEGER
    )
    WHERE NULLIF(btrim(ingredient.name), '') IS NULL
      OR COALESCE(ingredient.quantity, 0) < 0
      OR COALESCE(ingredient.calories, 0) < 0
      OR COALESCE(ingredient.protein_g, 0) < 0
      OR COALESCE(ingredient.carbs_g, 0) < 0
      OR COALESCE(ingredient.fat_g, 0) < 0
      OR ingredient.quantity::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR ingredient.calories::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR ingredient.protein_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR ingredient.carbs_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR ingredient.fat_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR COALESCE(ingredient.sort_order, -1) < 0
  ) THEN
    RAISE EXCEPTION 'recipe ingredients contain invalid values' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(sum(ingredient.calories::DOUBLE PRECISION), 0) / p_servings,
         COALESCE(sum(ingredient.protein_g::DOUBLE PRECISION), 0) / p_servings,
         COALESCE(sum(ingredient.carbs_g::DOUBLE PRECISION), 0) / p_servings,
         COALESCE(sum(ingredient.fat_g::DOUBLE PRECISION), 0) / p_servings
  INTO per_serving_calories, per_serving_protein, per_serving_carbs, per_serving_fat
  FROM jsonb_to_recordset(COALESCE(p_ingredients, '[]'::jsonb)) AS ingredient(
    name TEXT, quantity REAL, unit TEXT, calories REAL,
    protein_g REAL, carbs_g REAL, fat_g REAL, sort_order INTEGER
  );

  IF saved_recipe_id IS NULL THEN
    INSERT INTO public.recipes (
      name, description, prep_time_min, cook_time_min, servings,
      external_id, photo_file_name, photo_url, difficulty, tags, steps,
      calories, protein_g, carbs_g, fat_g, is_active, featured
    ) VALUES (
      btrim(p_name), NULLIF(btrim(p_description), ''), p_prep_time_min,
      p_cook_time_min, p_servings, NULLIF(btrim(p_external_id), ''),
      NULLIF(btrim(p_photo_file_name), ''), p_photo_url,
      NULLIF(btrim(p_difficulty), ''), COALESCE(p_tags, '[]'::jsonb),
      COALESCE(p_steps, '[]'::jsonb), per_serving_calories, per_serving_protein,
      per_serving_carbs, per_serving_fat, COALESCE(p_is_active, true),
      COALESCE(p_featured, false)
    )
    RETURNING id INTO saved_recipe_id;
  ELSE
    UPDATE public.recipes
    SET name = btrim(p_name),
        description = NULLIF(btrim(p_description), ''),
        prep_time_min = p_prep_time_min,
        cook_time_min = p_cook_time_min,
        servings = p_servings,
        external_id = NULLIF(btrim(p_external_id), ''),
        photo_file_name = NULLIF(btrim(p_photo_file_name), ''),
        photo_url = CASE WHEN p_replace_photo THEN p_photo_url ELSE photo_url END,
        difficulty = NULLIF(btrim(p_difficulty), ''),
        tags = COALESCE(p_tags, '[]'::jsonb),
        steps = COALESCE(p_steps, '[]'::jsonb),
        calories = per_serving_calories,
        protein_g = per_serving_protein,
        carbs_g = per_serving_carbs,
        fat_g = per_serving_fat,
        is_active = COALESCE(p_is_active, true),
        featured = COALESCE(p_featured, false),
        updated_at = now()
    WHERE id = saved_recipe_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'recipe % does not exist', saved_recipe_id
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.recipe_ingredients WHERE recipe_id = saved_recipe_id;

  INSERT INTO public.recipe_ingredients (
    recipe_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order
  )
  SELECT saved_recipe_id, btrim(ingredient.name), ingredient.quantity,
    NULLIF(btrim(ingredient.unit), ''), COALESCE(ingredient.calories, 0),
    COALESCE(ingredient.protein_g, 0), COALESCE(ingredient.carbs_g, 0),
    COALESCE(ingredient.fat_g, 0), ingredient.sort_order
  FROM jsonb_to_recordset(COALESCE(p_ingredients, '[]'::jsonb)) AS ingredient(
    name TEXT, quantity REAL, unit TEXT, calories REAL,
    protein_g REAL, carbs_g REAL, fat_g REAL, sort_order INTEGER
  )
  ORDER BY ingredient.sort_order;

  RETURN saved_recipe_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_recipe(
  UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, BOOLEAN,
  TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_recipe(
  UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, BOOLEAN,
  TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN, JSONB
) TO authenticated;

-- Version the expanded RPC so deployed clients keep their old signature while
-- the generator-aware editor adopts one atomic contract.
CREATE OR REPLACE FUNCTION public.admin_save_recipe_v2(
  p_recipe_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_prep_time_min INTEGER,
  p_cook_time_min INTEGER,
  p_servings INTEGER,
  p_external_id TEXT,
  p_photo_file_name TEXT,
  p_photo_url TEXT,
  p_replace_photo BOOLEAN,
  p_difficulty TEXT,
  p_tags JSONB,
  p_steps JSONB,
  p_is_active BOOLEAN,
  p_featured BOOLEAN,
  p_ingredients JSONB,
  p_eligible_for_generator BOOLEAN,
  p_macros_verified BOOLEAN,
  p_is_scalable BOOLEAN,
  p_allowed_portions NUMERIC[],
  p_fiber_g REAL,
  p_meal_types TEXT[],
  p_dietary_patterns TEXT[],
  p_allergens TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  saved_recipe_id UUID := p_recipe_id;
  per_serving_calories DOUBLE PRECISION;
  per_serving_protein DOUBLE PRECISION;
  per_serving_carbs DOUBLE PRECISION;
  per_serving_fat DOUBLE PRECISION;
BEGIN
  IF NOT (SELECT public.get_is_admin()) THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'recipe name is required' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_servings, 0) <= 0
    OR COALESCE(p_prep_time_min, 0) < 0
    OR COALESCE(p_cook_time_min, 0) < 0
  THEN
    RAISE EXCEPTION 'recipe time and serving values are invalid' USING ERRCODE = '22023';
  END IF;
  IF p_difficulty IS NOT NULL AND p_difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RAISE EXCEPTION 'recipe difficulty is invalid' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_tags, '[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(p_steps, '[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(p_ingredients, '[]'::jsonb)) <> 'array'
  THEN
    RAISE EXCEPTION 'recipe collections must be JSON arrays' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_ingredients, '[]'::jsonb)) AS ingredient(
      name TEXT, quantity REAL, unit TEXT, calories REAL,
      protein_g REAL, carbs_g REAL, fat_g REAL, sort_order INTEGER
    )
    WHERE NULLIF(btrim(ingredient.name), '') IS NULL
      OR COALESCE(ingredient.quantity, 0) < 0
      OR COALESCE(ingredient.calories, 0) < 0
      OR COALESCE(ingredient.protein_g, 0) < 0
      OR COALESCE(ingredient.carbs_g, 0) < 0
      OR COALESCE(ingredient.fat_g, 0) < 0
      OR ingredient.quantity::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR ingredient.calories::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR ingredient.protein_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR ingredient.carbs_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR ingredient.fat_g::TEXT IN ('NaN', 'Infinity', '-Infinity')
      OR COALESCE(ingredient.sort_order, -1) < 0
  ) THEN
    RAISE EXCEPTION 'recipe ingredients contain invalid values' USING ERRCODE = '22023';
  END IF;

  IF p_fiber_g < 0 OR p_fiber_g::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'fiber must be a non-negative finite value' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_allowed_portions, '{}'::NUMERIC[])) AS portion(value)
    WHERE portion.value IS NULL
      OR portion.value <= 0
      OR portion.value::TEXT IN ('NaN', 'Infinity', '-Infinity')
  ) THEN
    RAISE EXCEPTION 'allowed portions must contain only positive finite values' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_is_scalable, true) AND EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_allowed_portions, '{}'::NUMERIC[])) AS portion(value)
    WHERE portion.value <> trunc(portion.value)
  ) THEN
    RAISE EXCEPTION 'non-scalable recipes require whole-number allowed portions' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_meal_types, '{}'::TEXT[])) AS meal_type(value)
    WHERE meal_type.value IS NULL
      OR meal_type.value NOT IN ('breakfast', 'lunch', 'dinner', 'snack')
  ) THEN
    RAISE EXCEPTION 'recipe meal types are invalid' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_macros_verified, false)
    AND jsonb_array_length(COALESCE(p_ingredients, '[]'::jsonb)) = 0
  THEN
    RAISE EXCEPTION 'verified macros require at least one ingredient' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_eligible_for_generator, false)
    AND (
      NOT COALESCE(p_macros_verified, false)
      OR cardinality(COALESCE(p_meal_types, '{}'::TEXT[])) = 0
    )
  THEN
    RAISE EXCEPTION 'generator eligibility requires verified macros and at least one meal type'
      USING ERRCODE = '22023';
  END IF;

  -- Ingredient macros describe the whole recipe; recipe macros describe one serving.
  SELECT COALESCE(sum(ingredient.calories::DOUBLE PRECISION), 0) / p_servings,
         COALESCE(sum(ingredient.protein_g::DOUBLE PRECISION), 0) / p_servings,
         COALESCE(sum(ingredient.carbs_g::DOUBLE PRECISION), 0) / p_servings,
         COALESCE(sum(ingredient.fat_g::DOUBLE PRECISION), 0) / p_servings
  INTO per_serving_calories, per_serving_protein, per_serving_carbs, per_serving_fat
  FROM jsonb_to_recordset(COALESCE(p_ingredients, '[]'::jsonb)) AS ingredient(
    name TEXT, quantity REAL, unit TEXT, calories REAL,
    protein_g REAL, carbs_g REAL, fat_g REAL, sort_order INTEGER
  );

  IF per_serving_calories::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR per_serving_protein::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR per_serving_carbs::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR per_serving_fat::TEXT IN ('NaN', 'Infinity', '-Infinity')
  THEN
    RAISE EXCEPTION 'per-serving recipe macros must be finite' USING ERRCODE = '22023';
  END IF;

  IF saved_recipe_id IS NULL THEN
    INSERT INTO public.recipes (
      name, description, prep_time_min, cook_time_min, servings,
      external_id, photo_file_name, photo_url, difficulty, tags, steps,
      calories, protein_g, carbs_g, fat_g, is_active, featured,
      eligible_for_generator, macros_verified, is_scalable, allowed_portions,
      fiber_g, meal_types, dietary_patterns, allergens
    ) VALUES (
      btrim(p_name), NULLIF(btrim(p_description), ''), p_prep_time_min,
      p_cook_time_min, p_servings, NULLIF(btrim(p_external_id), ''),
      NULLIF(btrim(p_photo_file_name), ''), p_photo_url,
      NULLIF(btrim(p_difficulty), ''), COALESCE(p_tags, '[]'::jsonb),
      COALESCE(p_steps, '[]'::jsonb), per_serving_calories, per_serving_protein,
      per_serving_carbs, per_serving_fat, COALESCE(p_is_active, true),
      COALESCE(p_featured, false), COALESCE(p_eligible_for_generator, false),
      COALESCE(p_macros_verified, false), COALESCE(p_is_scalable, true),
      p_allowed_portions, p_fiber_g, COALESCE(p_meal_types, '{}'::TEXT[]),
      COALESCE(p_dietary_patterns, '{}'::TEXT[]), COALESCE(p_allergens, '{}'::TEXT[])
    )
    RETURNING id INTO saved_recipe_id;
  ELSE
    UPDATE public.recipes
    SET name = btrim(p_name),
        description = NULLIF(btrim(p_description), ''),
        prep_time_min = p_prep_time_min,
        cook_time_min = p_cook_time_min,
        servings = p_servings,
        external_id = NULLIF(btrim(p_external_id), ''),
        photo_file_name = NULLIF(btrim(p_photo_file_name), ''),
        photo_url = CASE WHEN p_replace_photo THEN p_photo_url ELSE photo_url END,
        difficulty = NULLIF(btrim(p_difficulty), ''),
        tags = COALESCE(p_tags, '[]'::jsonb),
        steps = COALESCE(p_steps, '[]'::jsonb),
        calories = per_serving_calories,
        protein_g = per_serving_protein,
        carbs_g = per_serving_carbs,
        fat_g = per_serving_fat,
        is_active = COALESCE(p_is_active, true),
        featured = COALESCE(p_featured, false),
        eligible_for_generator = COALESCE(p_eligible_for_generator, false),
        macros_verified = COALESCE(p_macros_verified, false),
        is_scalable = COALESCE(p_is_scalable, true),
        allowed_portions = p_allowed_portions,
        fiber_g = p_fiber_g,
        meal_types = COALESCE(p_meal_types, '{}'::TEXT[]),
        dietary_patterns = COALESCE(p_dietary_patterns, '{}'::TEXT[]),
        allergens = COALESCE(p_allergens, '{}'::TEXT[]),
        updated_at = now()
    WHERE id = saved_recipe_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'recipe % does not exist', saved_recipe_id
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.recipe_ingredients WHERE recipe_id = saved_recipe_id;

  INSERT INTO public.recipe_ingredients (
    recipe_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order
  )
  SELECT saved_recipe_id, btrim(ingredient.name), ingredient.quantity,
    NULLIF(btrim(ingredient.unit), ''), COALESCE(ingredient.calories, 0),
    COALESCE(ingredient.protein_g, 0), COALESCE(ingredient.carbs_g, 0),
    COALESCE(ingredient.fat_g, 0), ingredient.sort_order
  FROM jsonb_to_recordset(COALESCE(p_ingredients, '[]'::jsonb)) AS ingredient(
    name TEXT, quantity REAL, unit TEXT, calories REAL,
    protein_g REAL, carbs_g REAL, fat_g REAL, sort_order INTEGER
  )
  ORDER BY ingredient.sort_order;

  RETURN saved_recipe_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_recipe_v2(
  UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, BOOLEAN,
  TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN,
  NUMERIC[], REAL, TEXT[], TEXT[], TEXT[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_recipe_v2(
  UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, BOOLEAN,
  TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN, JSONB, BOOLEAN, BOOLEAN, BOOLEAN,
  NUMERIC[], REAL, TEXT[], TEXT[], TEXT[]
) TO authenticated;
