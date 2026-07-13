-- Harden admin management boundaries and make multi-table editor saves atomic.
--
-- This migration intentionally keeps privileged helpers in the unexposed
-- private schema. Public RPCs are SECURITY INVOKER unless a private helper is
-- required to supersede server-owned meal-plan lifecycle rows.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Authorization helpers and blocked-account enforcement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.get_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT p.is_admin
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
  ), false)
$$;

REVOKE ALL ON FUNCTION private.get_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.get_is_admin()
$$;

REVOKE ALL ON FUNCTION public.get_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.profile_protected_flags_are_valid(
  p_profile_id UUID,
  p_is_admin BOOLEAN,
  p_is_blocked BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_profile_id
      -- Admin elevation is never writable through the profile API.
      AND p.is_admin IS NOT DISTINCT FROM p_is_admin
      -- Only an existing admin may change the blocked flag.
      AND (
        p.is_blocked IS NOT DISTINCT FROM p_is_blocked
        OR private.get_is_admin()
      )
      AND (
        p_profile_id = (SELECT auth.uid())
        OR private.get_is_admin()
      )
  )
$$;

REVOKE ALL ON FUNCTION private.profile_protected_flags_are_valid(UUID, BOOLEAN, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.profile_protected_flags_are_valid(UUID, BOOLEAN, BOOLEAN)
  TO authenticated;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND is_admin = false
    AND is_blocked = false
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND private.profile_protected_flags_are_valid(id, is_admin, is_blocked)
  );

CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT public.get_is_admin()))
  WITH CHECK (
    (SELECT public.get_is_admin())
    AND private.profile_protected_flags_are_valid(id, is_admin, is_blocked)
  );

DROP FUNCTION IF EXISTS private.profile_admin_flag_is_unchanged(UUID, BOOLEAN);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_admin_not_blocked'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_admin_not_blocked
      CHECK (NOT (is_admin AND is_blocked));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.is_current_user_unblocked()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT NOT p.is_blocked
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
  ), false)
$$;

REVOKE ALL ON FUNCTION private.is_current_user_unblocked() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_current_user_unblocked() TO authenticated;

-- A restrictive policy is AND-combined with every existing permissive policy,
-- so an already-issued token loses data access immediately after blocking.
DO $$
DECLARE
  target_table RECORD;
BEGIN
  FOR target_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND c.relname NOT IN ('profiles', 'app_config')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS unblocked_accounts_only ON public.%I',
      target_table.relname
    );
    EXECUTE format(
      'CREATE POLICY unblocked_accounts_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.is_current_user_unblocked())) WITH CHECK ((SELECT private.is_current_user_unblocked()))',
      target_table.relname
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS unblocked_accounts_only ON storage.objects;
CREATE POLICY unblocked_accounts_only
  ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.is_current_user_unblocked()))
  WITH CHECK ((SELECT private.is_current_user_unblocked()));

-- ---------------------------------------------------------------------------
-- Chat: users can no longer forge, rewrite, or delete coach/AI messages
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS users_own_messages ON public.chat_messages;
DROP POLICY IF EXISTS admins_all_messages ON public.chat_messages;

CREATE POLICY users_select_own_chat_messages
  ON public.chat_messages FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY users_insert_own_chat_messages
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND sender_type = 'user'
  );

CREATE POLICY users_mark_own_chat_messages_read
  ON public.chat_messages FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY admins_select_human_chat_messages
  ON public.chat_messages FOR SELECT TO authenticated
  USING ((SELECT public.get_is_admin()) AND chat_type = 'human');

CREATE POLICY admins_insert_human_chat_messages
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_is_admin())
    AND chat_type = 'human'
    AND sender_type = 'coach'
  );

CREATE POLICY admins_mark_human_chat_messages_read
  ON public.chat_messages FOR UPDATE TO authenticated
  USING ((SELECT public.get_is_admin()) AND chat_type = 'human')
  WITH CHECK ((SELECT public.get_is_admin()) AND chat_type = 'human');

REVOKE ALL PRIVILEGES ON public.chat_messages FROM authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT INSERT (user_id, chat_type, sender_type, content_type, text_content, image_url)
  ON public.chat_messages TO authenticated;
GRANT UPDATE (read_at) ON public.chat_messages TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_messages_content_present'
      AND conrelid = 'public.chat_messages'::regclass
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_content_present CHECK (
        (content_type = 'text' AND NULLIF(btrim(text_content), '') IS NOT NULL)
        OR (content_type = 'image' AND NULLIF(btrim(image_url), '') IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_messages_sender_matches_chat'
      AND conrelid = 'public.chat_messages'::regclass
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_sender_matches_chat CHECK (
        (sender_type <> 'coach' OR chat_type = 'human')
        AND (sender_type <> 'ai' OR chat_type = 'ai')
      );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Recipe photo storage: public delivery, admin-only object management
-- ---------------------------------------------------------------------------

-- Public buckets serve known object URLs without a SELECT policy. Removing this
-- policy prevents anonymous enumeration of every user's meal-photo object path.
DROP POLICY IF EXISTS "Public read meal photos" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload recipe photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update recipe photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete recipe photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read recipe photo objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload recipe photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update recipe photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete recipe photos" ON storage.objects;

CREATE POLICY "Admins can read recipe photo objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-photos' AND (SELECT public.get_is_admin()));

CREATE POLICY "Admins can upload recipe photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-photos' AND (SELECT public.get_is_admin()));

CREATE POLICY "Admins can update recipe photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'recipe-photos' AND (SELECT public.get_is_admin()))
  WITH CHECK (bucket_id = 'recipe-photos' AND (SELECT public.get_is_admin()));

CREATE POLICY "Admins can delete recipe photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-photos' AND (SELECT public.get_is_admin()));

-- ---------------------------------------------------------------------------
-- Atomic workout editor save
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_save_workout(
  p_workout_id UUID,
  p_name TEXT,
  p_day_of_week INTEGER,
  p_notes TEXT,
  p_is_active BOOLEAN,
  p_exercises JSONB,
  p_assigned_user_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  saved_workout_id UUID := p_workout_id;
BEGIN
  IF NOT (SELECT public.get_is_admin()) THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'workout name is required' USING ERRCODE = '22023';
  END IF;
  IF p_day_of_week IS NOT NULL AND p_day_of_week NOT BETWEEN 0 AND 6 THEN
    RAISE EXCEPTION 'day_of_week must be between 0 and 6' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_exercises, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'exercises must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF saved_workout_id IS NULL THEN
    INSERT INTO public.workouts (
      coach_id, name, day_of_week, notes, is_active, source
    ) VALUES (
      (SELECT auth.uid()), btrim(p_name), p_day_of_week,
      NULLIF(btrim(p_notes), ''), COALESCE(p_is_active, true), 'coach'
    )
    RETURNING id INTO saved_workout_id;
  ELSE
    UPDATE public.workouts
    SET name = btrim(p_name),
        day_of_week = p_day_of_week,
        notes = NULLIF(btrim(p_notes), ''),
        is_active = COALESCE(p_is_active, true),
        updated_at = now()
    WHERE id = saved_workout_id AND source = 'coach';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'coach workout % does not exist', saved_workout_id
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_exercises, '[]'::jsonb)) AS exercise(
      exercise_id UUID, name TEXT, muscle_group TEXT, sets INTEGER,
      reps TEXT, rest_seconds INTEGER, tips TEXT, sort_order INTEGER
    )
    WHERE NULLIF(btrim(exercise.name), '') IS NULL
      OR COALESCE(exercise.sets, 0) < 0
    OR COALESCE(exercise.rest_seconds, 0) < 0
    OR COALESCE(exercise.sort_order, -1) < 0
  ) THEN
    RAISE EXCEPTION 'workout exercises contain invalid values' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.workout_exercises WHERE workout_id = saved_workout_id;

  INSERT INTO public.workout_exercises (
    workout_id, exercise_id, name, muscle_group, sets, reps,
    rest_seconds, tips, sort_order
  )
  SELECT saved_workout_id, exercise.exercise_id, btrim(exercise.name),
    NULLIF(btrim(exercise.muscle_group), ''), COALESCE(exercise.sets, 0),
    COALESCE(NULLIF(btrim(exercise.reps), ''), '0'),
    COALESCE(exercise.rest_seconds, 0), NULLIF(btrim(exercise.tips), ''),
    exercise.sort_order
  FROM jsonb_to_recordset(COALESCE(p_exercises, '[]'::jsonb)) AS exercise(
    exercise_id UUID, name TEXT, muscle_group TEXT, sets INTEGER,
    reps TEXT, rest_seconds INTEGER, tips TEXT, sort_order INTEGER
  )
  ORDER BY exercise.sort_order;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_assigned_user_ids, '{}'::uuid[])) requested(user_id)
    LEFT JOIN public.profiles profile ON profile.id = requested.user_id
    WHERE profile.id IS NULL
      OR profile.is_admin
      OR (
        profile.is_blocked
        AND NOT EXISTS (
          SELECT 1 FROM public.user_workouts existing
          WHERE existing.workout_id = saved_workout_id
            AND existing.user_id = requested.user_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'assignments include an unavailable athlete' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.user_workouts assignment
  WHERE assignment.workout_id = saved_workout_id
    AND NOT (
      assignment.user_id = ANY(COALESCE(p_assigned_user_ids, '{}'::uuid[]))
    );

  INSERT INTO public.user_workouts (workout_id, user_id)
  SELECT saved_workout_id, requested.user_id
  FROM (
    SELECT DISTINCT user_id
    FROM unnest(COALESCE(p_assigned_user_ids, '{}'::uuid[])) requested(user_id)
  ) requested
  ON CONFLICT (user_id, workout_id) DO NOTHING;

  RETURN saved_workout_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_workout(UUID, TEXT, INTEGER, TEXT, BOOLEAN, JSONB, UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_workout(UUID, TEXT, INTEGER, TEXT, BOOLEAN, JSONB, UUID[])
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Atomic recipe editor save with server-derived macro totals
-- ---------------------------------------------------------------------------

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
  total_calories REAL;
  total_protein REAL;
  total_carbs REAL;
  total_fat REAL;
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
      OR COALESCE(ingredient.sort_order, -1) < 0
  ) THEN
    RAISE EXCEPTION 'recipe ingredients contain invalid values' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(sum(ingredient.calories), 0)::REAL,
         COALESCE(sum(ingredient.protein_g), 0)::REAL,
         COALESCE(sum(ingredient.carbs_g), 0)::REAL,
         COALESCE(sum(ingredient.fat_g), 0)::REAL
  INTO total_calories, total_protein, total_carbs, total_fat
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
      COALESCE(p_steps, '[]'::jsonb), total_calories, total_protein,
      total_carbs, total_fat, COALESCE(p_is_active, true),
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
        calories = total_calories,
        protein_g = total_protein,
        carbs_g = total_carbs,
        fat_g = total_fat,
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

-- ---------------------------------------------------------------------------
-- Atomic manual meal-plan editor save and assignment lifecycle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.admin_save_manual_meal_plan(
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
  saved_plan_id UUID := p_plan_id;
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
  IF jsonb_typeof(COALESCE(p_meals, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'meals must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF saved_plan_id IS NULL THEN
    INSERT INTO public.meal_plans (
      coach_id, name, description, is_active, origin
    ) VALUES (
      (SELECT auth.uid()), btrim(p_name), NULLIF(btrim(p_description), ''), true, 'manual'
    )
    RETURNING id INTO saved_plan_id;
  ELSE
    UPDATE public.meal_plans
    SET name = btrim(p_name),
        description = NULLIF(btrim(p_description), ''),
        updated_at = now()
    WHERE id = saved_plan_id AND origin = 'manual';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'manual meal plan % does not exist', saved_plan_id
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.meals meal
  WHERE meal.meal_plan_id = saved_plan_id
    AND NOT (
      meal.id = ANY(COALESCE(p_preserved_meal_ids, '{}'::uuid[]))
    );

  FOR meal_record IN
    SELECT meal.day_of_week, meal.meal_type, meal.recipes
    FROM jsonb_to_recordset(COALESCE(p_meals, '[]'::jsonb)) AS meal(
      day_of_week INTEGER, meal_type TEXT, recipes JSONB
    )
  LOOP
    IF meal_record.day_of_week NOT BETWEEN 0 AND 6
      OR meal_record.meal_type NOT IN ('breakfast', 'lunch', 'dinner', 'snack')
      OR jsonb_typeof(COALESCE(meal_record.recipes, '[]'::jsonb)) <> 'array'
    THEN
      RAISE EXCEPTION 'meal plan contains an invalid meal' USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(COALESCE(meal_record.recipes, '[]'::jsonb)) <> (
      SELECT count(*)
      FROM jsonb_array_elements_text(COALESCE(meal_record.recipes, '[]'::jsonb)) AS recipe_id(id)
      JOIN public.recipes recipe ON recipe.id = recipe_id.id::uuid
    ) THEN
      RAISE EXCEPTION 'meal plan references an unavailable recipe' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.meals (
      meal_plan_id, name, day_of_week, time_of_day, sort_order
    ) VALUES (
      saved_plan_id,
      upper(meal_record.meal_type),
      meal_record.day_of_week,
      CASE meal_record.meal_type
        WHEN 'breakfast' THEN '08:00'
        WHEN 'lunch' THEN '12:30'
        WHEN 'dinner' THEN '19:00'
        ELSE '16:00'
      END,
      meal_record.day_of_week * 4
        + CASE meal_record.meal_type
            WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1
            WHEN 'dinner' THEN 2 ELSE 3
          END
    )
    RETURNING id INTO saved_meal_id;

    FOR recipe_record IN
      SELECT recipe.id, recipe.name, recipe.calories, recipe.protein_g,
             recipe.carbs_g, recipe.fat_g, recipe_id.ordinality::INTEGER - 1 AS sort_order
      FROM jsonb_array_elements_text(COALESCE(meal_record.recipes, '[]'::jsonb))
        WITH ORDINALITY AS recipe_id(id, ordinality)
      JOIN public.recipes recipe ON recipe.id = recipe_id.id::uuid
      ORDER BY recipe_id.ordinality
    LOOP
      INSERT INTO public.meal_plan_recipes (
        meal_plan_id, meal_id, recipe_id, meal_type, day_of_week,
        slot_kind, portion_multiplier, sort_order, snapshot_recipe_name,
        snapshot_calories, snapshot_protein_g, snapshot_carbs_g, snapshot_fat_g
      ) VALUES (
        saved_plan_id, saved_meal_id, recipe_record.id,
        meal_record.meal_type, meal_record.day_of_week,
        'recipe', 1, recipe_record.sort_order, recipe_record.name,
        recipe_record.calories, recipe_record.protein_g,
        recipe_record.carbs_g, recipe_record.fat_g
      );

      INSERT INTO public.meal_foods (
        meal_id, name, amount_grams, calories, protein_g, carbs_g, fat_g
      ) VALUES (
        saved_meal_id, recipe_record.name, 100, recipe_record.calories,
        recipe_record.protein_g, recipe_record.carbs_g, recipe_record.fat_g
      );
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_assigned_user_ids, '{}'::uuid[])) requested(user_id)
    LEFT JOIN public.profiles profile ON profile.id = requested.user_id
    WHERE profile.id IS NULL
      OR profile.is_admin
      OR (
        profile.is_blocked
        AND NOT EXISTS (
          SELECT 1 FROM public.user_meal_plans existing
          WHERE existing.meal_plan_id = saved_plan_id
            AND existing.user_id = requested.user_id
            AND existing.status = 'current'
        )
      )
  ) THEN
    RAISE EXCEPTION 'assignments include an unavailable athlete' USING ERRCODE = '22023';
  END IF;

  -- Serialize assignment lifecycle changes per user to protect the single-current index.
  PERFORM pg_advisory_xact_lock(hashtextextended(locked_user.user_id::text, 1))
  FROM (
    SELECT DISTINCT requested.user_id
    FROM unnest(COALESCE(p_assigned_user_ids, '{}'::uuid[])) requested(user_id)
    UNION
    SELECT assignment.user_id
    FROM public.user_meal_plans assignment
    WHERE assignment.meal_plan_id = saved_plan_id
      AND assignment.status = 'current'
  ) locked_user
  ORDER BY locked_user.user_id;

  UPDATE public.meal_plans generated_plan
  SET generation_status = 'superseded'
  WHERE generated_plan.origin = 'generated'
    AND generated_plan.generation_status IN ('generating', 'draft', 'published')
    AND EXISTS (
      SELECT 1
      FROM public.user_meal_plans current_assignment
      WHERE current_assignment.meal_plan_id = generated_plan.id
        AND current_assignment.status = 'current'
        AND current_assignment.user_id = ANY(COALESCE(p_assigned_user_ids, '{}'::uuid[]))
        AND current_assignment.meal_plan_id <> saved_plan_id
    );

  UPDATE public.user_meal_plans assignment
  SET status = 'superseded', effective_to = now()
  WHERE assignment.status = 'current'
    AND (
      assignment.user_id = ANY(COALESCE(p_assigned_user_ids, '{}'::uuid[]))
      OR (
        assignment.meal_plan_id = saved_plan_id
        AND NOT (
          assignment.user_id = ANY(COALESCE(p_assigned_user_ids, '{}'::uuid[]))
        )
      )
    );

  INSERT INTO public.user_meal_plans (
    user_id, meal_plan_id, assigned_at, status, effective_from, effective_to
  )
  SELECT requested.user_id, saved_plan_id, now(), 'current', now(), NULL
  FROM (
    SELECT DISTINCT user_id
    FROM unnest(COALESCE(p_assigned_user_ids, '{}'::uuid[])) requested(user_id)
  ) requested
  ON CONFLICT (user_id, meal_plan_id) DO UPDATE
  SET assigned_at = EXCLUDED.assigned_at,
      status = 'current',
      effective_from = EXCLUDED.effective_from,
      effective_to = NULL;

  RETURN saved_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_save_manual_meal_plan(UUID, TEXT, TEXT, JSONB, UUID[], UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_save_manual_meal_plan(UUID, TEXT, TEXT, JSONB, UUID[], UUID[])
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_save_manual_meal_plan(
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
  SELECT private.admin_save_manual_meal_plan(
    p_plan_id, p_name, p_description, p_meals,
    p_preserved_meal_ids, p_assigned_user_ids
  )
$$;

REVOKE ALL ON FUNCTION public.admin_save_manual_meal_plan(UUID, TEXT, TEXT, JSONB, UUID[], UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_manual_meal_plan(UUID, TEXT, TEXT, JSONB, UUID[], UUID[])
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Atomic quote activation with a database-level single-active invariant
-- ---------------------------------------------------------------------------

WITH ranked_active_quotes AS (
  SELECT id,
    row_number() OVER (
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.daily_quotes
  WHERE is_active
)
UPDATE public.daily_quotes quote
SET is_active = false, updated_at = now()
FROM ranked_active_quotes ranked
WHERE quote.id = ranked.id AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_quotes_one_active
  ON public.daily_quotes ((true)) WHERE is_active;

CREATE OR REPLACE FUNCTION public.admin_activate_quote(p_quote_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.get_is_admin()) THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.daily_quotes WHERE id = p_quote_id) THEN
    RAISE EXCEPTION 'quote % does not exist', p_quote_id USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.daily_quotes
  SET is_active = (id = p_quote_id), updated_at = now()
  WHERE is_active OR id = p_quote_id;

  RETURN p_quote_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_activate_quote(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activate_quote(UUID) TO authenticated;
