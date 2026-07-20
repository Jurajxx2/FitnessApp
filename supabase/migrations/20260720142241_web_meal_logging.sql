-- Incremental web meal logging: reusable snapshots, atomic persistence,
-- private meal photos, and server-only AI quota reservations.

-- ---------------------------------------------------------------------------
-- Existing meal-log metadata and snapshot integrity
-- ---------------------------------------------------------------------------

ALTER TABLE public.meal_logs
  ADD COLUMN meal_type TEXT;

ALTER TABLE public.meal_logs
  ADD CONSTRAINT meal_logs_meal_type_valid
    CHECK (meal_type IS NULL OR meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  ADD CONSTRAINT meal_logs_name_nonempty
    CHECK (NULLIF(btrim(meal_name), '') IS NOT NULL AND char_length(meal_name) <= 200),
  ADD CONSTRAINT meal_logs_logged_at_present
    CHECK (logged_at IS NOT NULL);

-- amount_grams is a compatibility field, not a generic quantity. Preserve the
-- richer amount/unit pair and only populate grams for genuinely gram-based rows.
UPDATE public.meal_log_foods
SET amount_grams = CASE
  WHEN lower(btrim(unit)) = 'g' THEN amount
  ELSE NULL
END
WHERE amount_grams IS DISTINCT FROM CASE
  WHEN lower(btrim(unit)) = 'g' THEN amount
  ELSE NULL
END;

ALTER TABLE public.meal_log_foods
  ALTER COLUMN amount DROP DEFAULT,
  ALTER COLUMN unit DROP DEFAULT,
  ALTER COLUMN amount_grams DROP DEFAULT,
  ADD CONSTRAINT meal_log_foods_name_nonempty
    CHECK (NULLIF(btrim(name), '') IS NOT NULL AND char_length(name) <= 200),
  ADD CONSTRAINT meal_log_foods_portion_valid
    CHECK (
      (amount IS NULL AND unit IS NULL AND amount_grams IS NULL)
      OR (
        amount IS NOT NULL
        AND amount >= 0
        AND amount < 'Infinity'::REAL
        AND NULLIF(btrim(unit), '') IS NOT NULL
        AND (
          (lower(btrim(unit)) = 'g' AND amount_grams = amount)
          OR (lower(btrim(unit)) <> 'g' AND amount_grams IS NULL)
        )
      )
    ),
  ADD CONSTRAINT meal_log_foods_macros_valid
    CHECK (
      calories IS NOT NULL AND calories >= 0 AND calories < 'Infinity'::REAL
      AND protein_g IS NOT NULL AND protein_g >= 0 AND protein_g < 'Infinity'::REAL
      AND carbs_g IS NOT NULL AND carbs_g >= 0 AND carbs_g < 'Infinity'::REAL
      AND fat_g IS NOT NULL AND fat_g >= 0 AND fat_g < 'Infinity'::REAL
    );

CREATE INDEX IF NOT EXISTS idx_meal_log_foods_meal_log
  ON public.meal_log_foods(meal_log_id);

-- Replace the legacy broad owner policies with operation-specific policies.
-- Separate admin SELECT policies remain in place and are narrowed to admins.
DROP POLICY IF EXISTS "Users manage own meal logs" ON public.meal_logs;
DROP POLICY IF EXISTS "Admin can read all meal logs" ON public.meal_logs;

CREATE POLICY "Users read own meal logs"
  ON public.meal_logs FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users insert own meal logs"
  ON public.meal_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users update own meal logs"
  ON public.meal_logs FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users delete own meal logs"
  ON public.meal_logs FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admin can read all meal logs"
  ON public.meal_logs FOR SELECT TO authenticated
  USING ((SELECT public.get_is_admin()));

DROP POLICY IF EXISTS "Users manage own meal log foods" ON public.meal_log_foods;
DROP POLICY IF EXISTS "Admin can read all meal log foods" ON public.meal_log_foods;

CREATE POLICY "Users read own meal log foods"
  ON public.meal_log_foods FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meal_logs log
      WHERE log.id = meal_log_id
        AND log.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users insert own meal log foods"
  ON public.meal_log_foods FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meal_logs log
      WHERE log.id = meal_log_id
        AND log.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users update own meal log foods"
  ON public.meal_log_foods FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meal_logs log
      WHERE log.id = meal_log_id
        AND log.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meal_logs log
      WHERE log.id = meal_log_id
        AND log.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users delete own meal log foods"
  ON public.meal_log_foods FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meal_logs log
      WHERE log.id = meal_log_id
        AND log.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admin can read all meal log foods"
  ON public.meal_log_foods FOR SELECT TO authenticated
  USING ((SELECT public.get_is_admin()));

-- ---------------------------------------------------------------------------
-- Personal food snapshots and reusable multi-item meals
-- ---------------------------------------------------------------------------

CREATE TABLE public.food_favorites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (NULLIF(btrim(name), '') IS NOT NULL AND char_length(name) <= 200),
  amount        REAL,
  unit          TEXT,
  amount_grams  REAL,
  calories      REAL NOT NULL CHECK (calories >= 0 AND calories < 'Infinity'::REAL),
  protein_g     REAL NOT NULL CHECK (protein_g >= 0 AND protein_g < 'Infinity'::REAL),
  carbs_g       REAL NOT NULL CHECK (carbs_g >= 0 AND carbs_g < 'Infinity'::REAL),
  fat_g         REAL NOT NULL CHECK (fat_g >= 0 AND fat_g < 'Infinity'::REAL),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT food_favorites_user_name_unique UNIQUE (user_id, name),
  CONSTRAINT food_favorites_portion_valid CHECK (
    (amount IS NULL AND unit IS NULL AND amount_grams IS NULL)
    OR (
      amount IS NOT NULL
      AND amount >= 0
      AND amount < 'Infinity'::REAL
      AND NULLIF(btrim(unit), '') IS NOT NULL
      AND (
        (lower(btrim(unit)) = 'g' AND amount_grams = amount)
        OR (lower(btrim(unit)) <> 'g' AND amount_grams IS NULL)
      )
    )
  )
);

CREATE INDEX idx_food_favorites_user_created
  ON public.food_favorites(user_id, created_at DESC);

ALTER TABLE public.food_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own food favorites"
  ON public.food_favorites FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users insert own food favorites"
  ON public.food_favorites FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users update own food favorites"
  ON public.food_favorites FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users delete own food favorites"
  ON public.food_favorites FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY unblocked_accounts_only
  ON public.food_favorites AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.is_current_user_unblocked()))
  WITH CHECK ((SELECT private.is_current_user_unblocked()));

CREATE POLICY feature_access_nutrition
  ON public.food_favorites AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.current_user_has_feature('nutrition')))
  WITH CHECK ((SELECT private.current_user_has_feature('nutrition')));

CREATE TABLE public.saved_meals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (NULLIF(btrim(name), '') IS NOT NULL AND char_length(name) <= 200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_meals_user_updated
  ON public.saved_meals(user_id, updated_at DESC);

ALTER TABLE public.saved_meals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER saved_meals_set_updated_at
  BEFORE UPDATE ON public.saved_meals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users read own saved meals"
  ON public.saved_meals FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users insert own saved meals"
  ON public.saved_meals FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users update own saved meals"
  ON public.saved_meals FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users delete own saved meals"
  ON public.saved_meals FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY unblocked_accounts_only
  ON public.saved_meals AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.is_current_user_unblocked()))
  WITH CHECK ((SELECT private.is_current_user_unblocked()));

CREATE POLICY feature_access_nutrition
  ON public.saved_meals AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.current_user_has_feature('nutrition')))
  WITH CHECK ((SELECT private.current_user_has_feature('nutrition')));

CREATE TABLE public.saved_meal_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_meal_id UUID NOT NULL REFERENCES public.saved_meals(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (NULLIF(btrim(name), '') IS NOT NULL AND char_length(name) <= 200),
  amount        REAL,
  unit          TEXT,
  amount_grams  REAL,
  calories      REAL NOT NULL CHECK (calories >= 0 AND calories < 'Infinity'::REAL),
  protein_g     REAL NOT NULL CHECK (protein_g >= 0 AND protein_g < 'Infinity'::REAL),
  carbs_g       REAL NOT NULL CHECK (carbs_g >= 0 AND carbs_g < 'Infinity'::REAL),
  fat_g         REAL NOT NULL CHECK (fat_g >= 0 AND fat_g < 'Infinity'::REAL),
  sort_order    INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT saved_meal_items_portion_valid CHECK (
    (amount IS NULL AND unit IS NULL AND amount_grams IS NULL)
    OR (
      amount IS NOT NULL
      AND amount >= 0
      AND amount < 'Infinity'::REAL
      AND NULLIF(btrim(unit), '') IS NOT NULL
      AND (
        (lower(btrim(unit)) = 'g' AND amount_grams = amount)
        OR (lower(btrim(unit)) <> 'g' AND amount_grams IS NULL)
      )
    )
  )
);

CREATE INDEX idx_saved_meal_items_meal_order
  ON public.saved_meal_items(saved_meal_id, sort_order);

ALTER TABLE public.saved_meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own saved meal items"
  ON public.saved_meal_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.saved_meals meal
      WHERE meal.id = saved_meal_id
        AND meal.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users insert own saved meal items"
  ON public.saved_meal_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.saved_meals meal
      WHERE meal.id = saved_meal_id
        AND meal.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users update own saved meal items"
  ON public.saved_meal_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.saved_meals meal
      WHERE meal.id = saved_meal_id
        AND meal.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.saved_meals meal
      WHERE meal.id = saved_meal_id
        AND meal.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users delete own saved meal items"
  ON public.saved_meal_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.saved_meals meal
      WHERE meal.id = saved_meal_id
        AND meal.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY unblocked_accounts_only
  ON public.saved_meal_items AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.is_current_user_unblocked()))
  WITH CHECK ((SELECT private.is_current_user_unblocked()));

CREATE POLICY feature_access_nutrition
  ON public.saved_meal_items AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.current_user_has_feature('nutrition')))
  WITH CHECK ((SELECT private.current_user_has_feature('nutrition')));

REVOKE ALL ON public.food_favorites, public.saved_meals, public.saved_meal_items
  FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.food_favorites, public.saved_meals, public.saved_meal_items
  TO authenticated;

-- Saved meals are parent/item bundles and must not be observable half-written.
CREATE OR REPLACE FUNCTION public.save_saved_meal(
  p_name TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  saved_meal_id UUID;
  current_user_id UUID := (SELECT auth.uid());
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_name), '') IS NULL OR char_length(p_name) > 200 THEN
    RAISE EXCEPTION 'saved meal name is required and must be at most 200 characters'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'items must contain 1 to 100 entries' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS item(
      name TEXT,
      amount REAL,
      unit TEXT,
      calories REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL
    )
    WHERE NULLIF(btrim(item.name), '') IS NULL
      OR char_length(item.name) > 200
      OR item.calories IS NULL OR item.calories < 0 OR item.calories >= 'Infinity'::REAL
      OR item.protein_g IS NULL OR item.protein_g < 0 OR item.protein_g >= 'Infinity'::REAL
      OR item.carbs_g IS NULL OR item.carbs_g < 0 OR item.carbs_g >= 'Infinity'::REAL
      OR item.fat_g IS NULL OR item.fat_g < 0 OR item.fat_g >= 'Infinity'::REAL
      OR (item.amount IS NULL AND item.unit IS NOT NULL)
      OR (item.amount IS NOT NULL AND NULLIF(btrim(item.unit), '') IS NULL)
      OR item.amount < 0
      OR item.amount >= 'Infinity'::REAL
  ) THEN
    RAISE EXCEPTION 'one or more saved meal items are invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.saved_meals(user_id, name)
  VALUES (current_user_id, btrim(p_name))
  RETURNING id INTO saved_meal_id;

  INSERT INTO public.saved_meal_items(
    saved_meal_id, name, amount, unit, amount_grams,
    calories, protein_g, carbs_g, fat_g, sort_order
  )
  SELECT
    saved_meal_id,
    btrim(item.name),
    item.amount,
    NULLIF(btrim(item.unit), ''),
    CASE WHEN lower(btrim(item.unit)) = 'g' THEN item.amount ELSE NULL END,
    item.calories,
    item.protein_g,
    item.carbs_g,
    item.fat_g,
    (element.ordinality - 1)::INTEGER
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS element(value, ordinality)
  CROSS JOIN LATERAL jsonb_to_record(element.value) AS item(
    name TEXT,
    amount REAL,
    unit TEXT,
    calories REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL
  );

  RETURN saved_meal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_saved_meal(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_saved_meal(TEXT, JSONB) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- One transaction for the meal parent and all item snapshots
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_meal_log(
  p_meal_log_id UUID,
  p_meal_name TEXT,
  p_meal_type TEXT,
  p_logged_at TIMESTAMPTZ,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  saved_log_id UUID := p_meal_log_id;
  current_user_id UUID := (SELECT auth.uid());
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_meal_name), '') IS NULL OR char_length(p_meal_name) > 200 THEN
    RAISE EXCEPTION 'meal name is required and must be at most 200 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_meal_type IS NOT NULL
    AND p_meal_type NOT IN ('breakfast', 'lunch', 'dinner', 'snack')
  THEN
    RAISE EXCEPTION 'invalid meal type' USING ERRCODE = '22023';
  END IF;
  IF p_logged_at IS NULL THEN
    RAISE EXCEPTION 'logged_at is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'items must contain 1 to 100 entries' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS item(
      name TEXT,
      amount REAL,
      unit TEXT,
      calories REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL
    )
    WHERE NULLIF(btrim(item.name), '') IS NULL
      OR char_length(item.name) > 200
      OR item.calories IS NULL OR item.calories < 0 OR item.calories >= 'Infinity'::REAL
      OR item.protein_g IS NULL OR item.protein_g < 0 OR item.protein_g >= 'Infinity'::REAL
      OR item.carbs_g IS NULL OR item.carbs_g < 0 OR item.carbs_g >= 'Infinity'::REAL
      OR item.fat_g IS NULL OR item.fat_g < 0 OR item.fat_g >= 'Infinity'::REAL
      OR (item.amount IS NULL AND item.unit IS NOT NULL)
      OR (item.amount IS NOT NULL AND NULLIF(btrim(item.unit), '') IS NULL)
      OR item.amount < 0
      OR item.amount >= 'Infinity'::REAL
  ) THEN
    RAISE EXCEPTION 'one or more meal items are invalid' USING ERRCODE = '22023';
  END IF;

  IF saved_log_id IS NULL THEN
    INSERT INTO public.meal_logs (
      user_id, meal_name, meal_type, logged_at, notes, image_url
    ) VALUES (
      current_user_id,
      btrim(p_meal_name),
      p_meal_type,
      p_logged_at,
      NULLIF(btrim(p_notes), ''),
      NULL
    )
    RETURNING id INTO saved_log_id;
  ELSE
    UPDATE public.meal_logs
    SET meal_name = btrim(p_meal_name),
        meal_type = p_meal_type,
        logged_at = p_logged_at,
        notes = NULLIF(btrim(p_notes), '')
    WHERE id = saved_log_id
      AND user_id = current_user_id
    RETURNING id INTO saved_log_id;

    IF saved_log_id IS NULL THEN
      RAISE EXCEPTION 'meal log not found' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.meal_log_foods
    WHERE meal_log_id = saved_log_id;
  END IF;

  INSERT INTO public.meal_log_foods (
    meal_log_id, name, amount, unit, amount_grams,
    calories, protein_g, carbs_g, fat_g
  )
  SELECT
    saved_log_id,
    btrim(item.name),
    item.amount,
    NULLIF(btrim(item.unit), ''),
    CASE WHEN lower(btrim(item.unit)) = 'g' THEN item.amount ELSE NULL END,
    item.calories,
    item.protein_g,
    item.carbs_g,
    item.fat_g
  FROM jsonb_to_recordset(p_items) AS item(
    name TEXT,
    amount REAL,
    unit TEXT,
    calories REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL
  );

  RETURN saved_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_meal_log(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_meal_log(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Race-safe AI analysis quota; only a server-side service-role client can call
-- the public invoker wrapper or access the private event table.
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE private.meal_photo_analysis_quota_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX meal_photo_analysis_quota_user_requested
  ON private.meal_photo_analysis_quota_events(user_id, requested_at DESC);

REVOKE ALL ON private.meal_photo_analysis_quota_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON private.meal_photo_analysis_quota_events TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_meal_photo_analysis_quota(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reservation_time TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meal_photo_analysis:' || p_user_id::TEXT, 0)
  );

  DELETE FROM private.meal_photo_analysis_quota_events
  WHERE user_id = p_user_id
    AND requested_at < reservation_time - INTERVAL '24 hours';

  IF (
    SELECT count(*)
    FROM private.meal_photo_analysis_quota_events
    WHERE user_id = p_user_id
      AND requested_at >= reservation_time - INTERVAL '1 minute'
  ) >= 3 OR (
    SELECT count(*)
    FROM private.meal_photo_analysis_quota_events
    WHERE user_id = p_user_id
      AND requested_at >= reservation_time - INTERVAL '24 hours'
  ) >= 20 THEN
    RETURN false;
  END IF;

  INSERT INTO private.meal_photo_analysis_quota_events(user_id, requested_at)
  VALUES (p_user_id, reservation_time);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_meal_photo_analysis_quota(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_meal_photo_analysis_quota(UUID)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Private meal-photo delivery and owner object lifecycle
-- ---------------------------------------------------------------------------

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]
WHERE id = 'meal-photos';

-- The column keeps its legacy name for compatibility, but now stores the
-- bucket-relative object path used to create short-lived signed URLs.
UPDATE public.meal_logs
SET image_url = regexp_replace(
  split_part(image_url, '?', 1),
  '^.*/storage/v1/object/public/meal-photos/',
  ''
)
WHERE image_url LIKE '%/storage/v1/object/public/meal-photos/%';

DROP POLICY IF EXISTS "Public read meal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own meal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users read own meal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users update own meal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own meal photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins read meal photos" ON storage.objects;

CREATE POLICY "Users read own meal photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'meal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND (SELECT private.current_user_has_feature('nutrition'))
  );

CREATE POLICY "Users upload own meal photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'meal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND (SELECT private.current_user_has_feature('nutrition'))
  );

CREATE POLICY "Users update own meal photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'meal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND (SELECT private.current_user_has_feature('nutrition'))
  )
  WITH CHECK (
    bucket_id = 'meal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND (SELECT private.current_user_has_feature('nutrition'))
  );

CREATE POLICY "Users delete own meal photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'meal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND (SELECT private.current_user_has_feature('nutrition'))
  );

CREATE POLICY "Admins read meal photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meal-photos' AND (SELECT public.get_is_admin()));
