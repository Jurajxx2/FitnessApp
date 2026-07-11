-- Public URL of the compact Lottie preview for an exercise.
-- The existing exercises RLS policies continue to govern access to this metadata.
ALTER TABLE public.exercises
    ADD COLUMN IF NOT EXISTS animation_url text;

-- Map common exercise families to the corresponding public Lottie animation.
WITH assignments AS (
    SELECT
        id,
        CASE
            WHEN lower(name_en) ~ 'goblet.*squat' THEN 'goblet-squat'
            WHEN lower(name_en) ~ 'squat' THEN 'barbell-back-squat'
            WHEN lower(name_en) ~ 'romanian deadlift|\mrdl\M' THEN 'romanian-deadlift'
            WHEN lower(name_en) ~ 'deadlift' THEN 'barbell-deadlift'
            WHEN lower(name_en) ~ 'hip thrust|glute bridge' THEN 'barbell-hip-thrust'
            WHEN lower(name_en) ~ 'leg press' THEN 'leg-press'
            WHEN lower(name_en) ~ 'leg extension' THEN 'leg-extension'
            WHEN lower(name_en) ~ 'leg curl|hamstring curl' THEN 'leg-curl'
            WHEN lower(name_en) ~ 'calf raise' THEN 'standing-calf-raise'
            WHEN lower(name_en) ~ 'kettlebell swing' THEN 'kettlebell-swing'
            WHEN lower(name_en) ~ 'step.?up|step ups' THEN 'step-up'
            WHEN lower(name_en) ~ 'lunge' THEN 'dumbbell-lunge'
            WHEN lower(name_en) ~ 'mountain climber' THEN 'mountain-climber'
            WHEN lower(name_en) ~ 'burpee' THEN 'burpee'
            WHEN lower(name_en) ~ 'russian twist' THEN 'russian-twist'
            WHEN lower(name_en) ~ 'hanging (leg|knee) raise' THEN 'hanging-leg-raise'
            WHEN lower(name_en) ~ 'plank' THEN 'plank'
            WHEN lower(name_en) ~ 'crunch|sit.?up' THEN 'crunch'
            WHEN lower(name_en) ~ 'push.?up' THEN 'push-up'
            WHEN lower(name_en) ~ 'bench press' THEN 'barbell-bench-press'
            WHEN lower(name_en) ~ 'overhead press|shoulder press|military press' THEN 'overhead-press'
            WHEN lower(name_en) ~ 'triceps.*pushdown|pushdown' THEN 'triceps-pushdown'
            WHEN lower(name_en) ~ 'lat pulldown|lat pull.?down|pulldown' THEN 'lat-pulldown'
            WHEN lower(name_en) ~ 'pull.?up|pullup|chin.?up|chinup' THEN 'pull-up'
            WHEN lower(name_en) ~ 'bent over.*row|bent-over.*row' THEN 'bent-over-row'
            WHEN lower(name_en) ~ 'cable chest fly|cable fly|chest fly' THEN 'cable-chest-fly'
            WHEN lower(name_en) ~ 'lateral raise|side raise' THEN 'dumbbell-lateral-raise'
            WHEN lower(name_en) ~ 'front raise' THEN 'dumbbell-front-raise'
            WHEN lower(name_en) ~ 'curl' THEN 'dumbbell-bicep-curl'
            WHEN lower(name_en) ~ '(^| )dip' THEN 'dip'
            WHEN lower(name_en) ~ 'row' THEN 'bent-over-row'
        END AS animation_slug
    FROM public.exercises
)
UPDATE public.exercises AS exercise
SET animation_url = concat(
    'https://nsrhhvwytusltnikqplk.supabase.co/storage/v1/object/public/exercises/animations/',
    assignments.animation_slug,
    '.json'
)
FROM assignments
WHERE exercise.id = assignments.id
  AND assignments.animation_slug IS NOT NULL;
