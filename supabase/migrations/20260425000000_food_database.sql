-- supabase/migrations/20260425000000_food_database.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Master food database (verified by coach)
CREATE TABLE foods (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    calories      REAL NOT NULL DEFAULT 0,
    protein_g     REAL NOT NULL DEFAULT 0,
    carbs_g       REAL NOT NULL DEFAULT 0,
    fat_g         REAL NOT NULL DEFAULT 0,
    serving_size  REAL NOT NULL DEFAULT 100,
    serving_unit  TEXT NOT NULL DEFAULT 'g',
    brand         TEXT,
    is_verified   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

-- Everyone can read verified foods
CREATE POLICY "Anyone can read verified foods"
    ON foods FOR SELECT TO authenticated
    USING (true);

-- Only admins can manage the food database
CREATE POLICY "Admins can manage foods"
    ON foods FOR ALL TO authenticated
    USING (get_is_admin());

CREATE INDEX idx_foods_name_search ON foods USING gin (name gin_trgm_ops);

-- Seed some common foods
INSERT INTO foods (name, calories, protein_g, carbs_g, fat_g, serving_size, serving_unit) VALUES
('Chicken Breast (Cooked)', 165, 31, 0, 3.6, 100, 'g'),
('Chicken Breast (Raw)', 120, 23, 0, 1.2, 100, 'g'),
('White Rice (Cooked)', 130, 2.7, 28, 0.3, 100, 'g'),
('White Rice (Raw)', 365, 7, 80, 0.7, 100, 'g'),
('Brown Rice (Cooked)', 110, 2.6, 23, 0.9, 100, 'g'),
('Whole Egg (Large)', 70, 6, 0.4, 5, 50, 'g'),
('Egg White (Large)', 17, 3.6, 0.2, 0.1, 33, 'g'),
('Oats (Dry)', 389, 16.9, 66, 6.9, 100, 'g'),
('Broccoli (Raw)', 34, 2.8, 7, 0.4, 100, 'g'),
('Sweet Potato (Raw)', 86, 1.6, 20, 0.1, 100, 'g'),
('Whey Protein Isolate', 110, 25, 2, 0.5, 30, 'g'),
('Peanut Butter', 588, 25, 20, 50, 100, 'g'),
('Banana', 89, 1.1, 23, 0.3, 100, 'g'),
('Greek Yogurt (Non-fat)', 59, 10, 3.6, 0.4, 100, 'g'),
('Avocado', 160, 2, 8.5, 14.7, 100, 'g'),
('Lean Ground Beef (95%)', 137, 21, 0, 5, 100, 'g'),
('Salmon (Atlantic)', 208, 20, 0, 13, 100, 'g'),
('Almonds', 579, 21, 22, 50, 100, 'g'),
('Olive Oil', 884, 0, 0, 100, 100, 'ml'),
('Pasta (Dry)', 370, 13, 75, 1.5, 100, 'g');
