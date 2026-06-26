-- Add a curated "featured" flag to recipes for the Nutrition hub slider.
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
