
-- Repoint workouts.user_id and meal_plans.user_id to profiles(id)
-- so PostgREST can resolve the relationship for joined queries.
-- profiles.id = auth.users.id so this is data-safe.

ALTER TABLE workouts
  DROP CONSTRAINT workouts_user_id_fkey,
  ADD CONSTRAINT workouts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE meal_plans
  DROP CONSTRAINT meal_plans_user_id_fkey,
  ADD CONSTRAINT meal_plans_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
