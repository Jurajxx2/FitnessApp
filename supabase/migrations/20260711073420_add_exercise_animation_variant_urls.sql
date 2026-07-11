-- Dedicated Storage URLs for the gendered exercise-preview variants.
ALTER TABLE public.exercises
    ADD COLUMN IF NOT EXISTS animation_url_male text,
    ADD COLUMN IF NOT EXISTS animation_url_female text;

-- Attach the current workout's exercise rows to their existing catalog records,
-- then seed URLs for both variants. The existing animation_url remains the
-- compatible default used by clients that have not yet added a variant selector.
WITH animation_assets(name_en, slug) AS (
    VALUES
        ('World''s Greatest Stretch', 'worlds-greatest-stretch'),
        ('Ankle On The Knee', 'ankle-on-the-knee'),
        ('Anterior Tibialis-SMR', 'anterior-tibialis-smr'),
        ('Axle Deadlift', 'axle-deadlift'),
        ('Ab Roller', 'ab-roller')
)
UPDATE public.exercises AS exercise
SET
    animation_url = concat(
        'https://nsrhhvwytusltnikqplk.supabase.co/storage/v1/object/public/exercises/animations/workout-test/',
        animation_assets.slug,
        '-man.json'
    ),
    animation_url_male = concat(
        'https://nsrhhvwytusltnikqplk.supabase.co/storage/v1/object/public/exercises/animations/workout-test/',
        animation_assets.slug,
        '-man.json'
    ),
    animation_url_female = concat(
        'https://nsrhhvwytusltnikqplk.supabase.co/storage/v1/object/public/exercises/animations/workout-test/',
        animation_assets.slug,
        '-woman.json'
    )
FROM animation_assets
WHERE exercise.name_en = animation_assets.name_en;

UPDATE public.workout_exercises AS workout_exercise
SET exercise_id = exercise.id
FROM public.exercises AS exercise
WHERE workout_exercise.exercise_id IS NULL
  AND workout_exercise.name = exercise.name_en
  AND exercise.name_en IN (
    'World''s Greatest Stretch',
    'Ankle On The Knee',
    'Anterior Tibialis-SMR',
    'Axle Deadlift',
    'Ab Roller'
  );
