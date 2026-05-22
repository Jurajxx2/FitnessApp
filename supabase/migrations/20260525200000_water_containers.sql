CREATE TABLE IF NOT EXISTS water_containers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  volume_ml   INTEGER NOT NULL CHECK (volume_ml > 0),
  icon_name   TEXT NOT NULL DEFAULT 'bottle',
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE water_containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own water containers"
  ON water_containers FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_water_containers_user
  ON water_containers(user_id, is_favorite DESC, created_at DESC);
