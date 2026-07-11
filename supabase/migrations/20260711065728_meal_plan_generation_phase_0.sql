-- Phase 0 — meal-plan generation catalogue contract and audit backfill.
--
-- Recipe-level nutrition is one serving.  Ingredient nutrition stays the
-- whole recipe as written, divided by recipes.servings only for this audit.
-- The controlled meal types below are a provisional classification of the
-- existing catalogue and must be coach-reviewed before generation is enabled.

-- The application has used this four-value taxonomy since the onboarding
-- migration. Keep this defensive remap for databases that were provisioned
-- before it, and make the database contract explicit for schema consumers.
UPDATE public.profiles
SET goal = CASE goal
  WHEN 'weight_loss' THEN 'lose_weight'
  WHEN 'muscle_gain' THEN 'build_muscle'
  WHEN 'mental_strength' THEN NULL
  ELSE goal
END
WHERE goal IN ('weight_loss', 'muscle_gain', 'mental_strength');

COMMENT ON COLUMN public.profiles.goal IS
  'Fitness goal: lose_weight | build_muscle | get_stronger | stay_fit; legacy mental_strength maps to NULL.';

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS meal_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_patterns TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergens TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fiber_g REAL,
  ADD COLUMN IF NOT EXISTS is_scalable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allowed_portions NUMERIC[],
  ADD COLUMN IF NOT EXISTS eligible_for_generator BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS macros_verified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.recipes.calories IS
  'Calories for exactly one serving. Ingredient totals are for the whole recipe as written.';
COMMENT ON COLUMN public.recipes.protein_g IS
  'Protein grams for exactly one serving. Ingredient totals are for the whole recipe as written.';
COMMENT ON COLUMN public.recipes.carbs_g IS
  'Carbohydrate grams for exactly one serving. Ingredient totals are for the whole recipe as written.';
COMMENT ON COLUMN public.recipes.fat_g IS
  'Fat grams for exactly one serving. Ingredient totals are for the whole recipe as written.';

-- Classify the current nine recipes so the coverage audit is reproducible.
-- New recipes must be entered with controlled meal_types by the coach.
UPDATE public.recipes
SET meal_types = CASE name
  WHEN 'Avocado Egg Toast' THEN ARRAY['breakfast']::TEXT[]
  WHEN 'Greek Yogurt Parfait' THEN ARRAY['breakfast', 'snack']::TEXT[]
  WHEN 'Overnight Oats' THEN ARRAY['breakfast']::TEXT[]
  WHEN 'Tuna Salad Wrap' THEN ARRAY['lunch']::TEXT[]
  WHEN 'Chicken Rice Bowl' THEN ARRAY['lunch', 'dinner']::TEXT[]
  WHEN 'Beef Stir Fry' THEN ARRAY['lunch', 'dinner']::TEXT[]
  WHEN 'Quinoa Veggie Bowl' THEN ARRAY['lunch', 'dinner']::TEXT[]
  WHEN 'Grilled Salmon with Sweet Potato' THEN ARRAY['dinner']::TEXT[]
  WHEN 'Turkey Meatballs with Pasta' THEN ARRAY['dinner']::TEXT[]
  ELSE meal_types
END
WHERE name IN (
  'Avocado Egg Toast',
  'Greek Yogurt Parfait',
  'Overnight Oats',
  'Tuna Salad Wrap',
  'Chicken Rice Bowl',
  'Beef Stir Fry',
  'Quinoa Veggie Bowl',
  'Grilled Salmon with Sweet Potato',
  'Turkey Meatballs with Pasta'
);

-- A recipe passes only when it has ingredients and each ingredient total,
-- converted to one serving, is within 10% of the recipe-level macro. The
-- small absolute tolerance makes a zero-valued macro well-defined.
WITH ingredient_totals AS (
  SELECT
    r.id,
    r.servings,
    r.calories,
    r.protein_g,
    r.carbs_g,
    r.fat_g,
    COUNT(ri.id) AS ingredient_count,
    COALESCE(SUM(ri.calories), 0) AS ingredient_calories,
    COALESCE(SUM(ri.protein_g), 0) AS ingredient_protein_g,
    COALESCE(SUM(ri.carbs_g), 0) AS ingredient_carbs_g,
    COALESCE(SUM(ri.fat_g), 0) AS ingredient_fat_g
  FROM public.recipes r
  LEFT JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  GROUP BY r.id
), audit AS (
  SELECT id,
    ingredient_count > 0
      AND ABS(ingredient_calories / NULLIF(servings, 0) - calories) <= GREATEST(ABS(calories) * 0.10, 0.01)
      AND ABS(ingredient_protein_g / NULLIF(servings, 0) - protein_g) <= GREATEST(ABS(protein_g) * 0.10, 0.01)
      AND ABS(ingredient_carbs_g / NULLIF(servings, 0) - carbs_g) <= GREATEST(ABS(carbs_g) * 0.10, 0.01)
      AND ABS(ingredient_fat_g / NULLIF(servings, 0) - fat_g) <= GREATEST(ABS(fat_g) * 0.10, 0.01)
      AS passes_macro_audit
  FROM ingredient_totals
)
UPDATE public.recipes r
SET
  macros_verified = audit.passes_macro_audit,
  eligible_for_generator = audit.passes_macro_audit
    AND CARDINALITY(r.meal_types) > 0
FROM audit
WHERE r.id = audit.id;
