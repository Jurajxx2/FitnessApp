-- Soft-disable recipes while retaining existing meal-plan and favorite references.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Recipe catalog queries only show active recipes; retain an efficient index for that path.
CREATE INDEX IF NOT EXISTS idx_recipes_active_name
  ON public.recipes (name)
  WHERE is_active;
