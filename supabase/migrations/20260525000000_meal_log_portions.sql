-- Add flexible amount + unit columns to meal_log_foods (legacy amount_grams kept for backfill).
ALTER TABLE meal_log_foods
  ADD COLUMN IF NOT EXISTS amount REAL,
  ADD COLUMN IF NOT EXISTS unit   TEXT;

-- Backfill existing rows from amount_grams.
UPDATE meal_log_foods
SET amount = amount_grams,
    unit   = 'g'
WHERE amount IS NULL;

-- New rows must have a portion.
ALTER TABLE meal_log_foods
  ALTER COLUMN amount SET DEFAULT 100,
  ALTER COLUMN unit   SET DEFAULT 'g';
