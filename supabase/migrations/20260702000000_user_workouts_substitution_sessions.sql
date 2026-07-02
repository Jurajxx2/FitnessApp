-- User-authored workout plans, exercise substitution, resumable sessions.
-- Model: coach plans stay read-only (source='coach'); user plans/forks are rows in the
-- same workouts table with source='user' + owner_user_id. Forks record lineage so the
-- coach can later see substitutions (surfacing deferred).

-- 1. workouts: source + owner + fork lineage
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'coach' CHECK (source IN ('coach','user')),
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS forked_from_workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL;

ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_user_source_owner;
ALTER TABLE workouts ADD CONSTRAINT workouts_user_source_owner
  CHECK (source = 'coach' OR owner_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_workouts_owner
  ON workouts(owner_user_id) WHERE owner_user_id IS NOT NULL;

-- Global feed must now exclude user-authored plans.
DROP POLICY IF EXISTS "Users can read assigned workouts" ON workouts;
CREATE POLICY "Users can read assigned workouts"
  ON workouts FOR SELECT
  USING (
    (user_id IS NULL AND source = 'coach')
    OR auth.uid() = user_id
    OR auth.uid() = owner_user_id
  );

-- Users fully manage their own plans (insert must be source='user' owned by them).
DROP POLICY IF EXISTS "Users manage own workouts" ON workouts;
CREATE POLICY "Users manage own workouts"
  ON workouts FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid() AND source = 'user');

-- Coach/admin can read user plans (substitution visibility later).
DROP POLICY IF EXISTS "Admins read all workouts" ON workouts;
CREATE POLICY "Admins read all workouts"
  ON workouts FOR SELECT TO authenticated
  USING (get_is_admin());

-- 2. workout_exercises: substitution record + user RLS
ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS substituted_from_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substituted_from_name TEXT;

DROP POLICY IF EXISTS "Users can read exercises for accessible workouts" ON workout_exercises;
CREATE POLICY "Users can read exercises for accessible workouts"
  ON workout_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id
        AND ((w.user_id IS NULL AND w.source = 'coach')
             OR w.user_id = auth.uid()
             OR w.owner_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users manage exercises of own workouts" ON workout_exercises;
CREATE POLICY "Users manage exercises of own workouts"
  ON workout_exercises FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.owner_user_id = auth.uid()));

-- 3. exercise_logs: record what was performed + what it replaced (session-scope substitution)
ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substituted_from_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substituted_from_name TEXT;

-- 4. workout_logs: resumable sessions. Existing rows default to 'completed'.
ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('in_progress','completed','discarded'));

CREATE INDEX IF NOT EXISTS idx_workout_logs_in_progress
  ON workout_logs(user_id) WHERE status = 'in_progress';
