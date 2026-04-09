# Exercises — Migrate from wger API to Supabase

**Date:** 2026-04-09  
**Status:** Approved

## Background

Exercises are currently fetched live from the public `wger.de` REST API. This creates an external dependency with no SLA — the API could go down, change, or disappear. The `workout_exercises` table already stores a soft `wger_exercise_id` reference but no hard ownership of exercise data.

The goal is to fully replace wger with a self-hosted exercise library in Supabase, seeded from wger as a starting point, then owned and curated going forward via the admin panel.

## Decisions

- **Full replacement** — no wger calls remain after migration; no fallback, no hybrid.
- **Seed from wger** — one-time bulk import of ~900 exercises as starting data, then owned internally.
- **EN + CS translations** — import English and Czech (language ID 9) from wger. Czech is stored as nullable; falls back to English in the app when missing.
- **Images to Supabase Storage** — wger image URLs are downloaded and re-uploaded during import. No remaining dependency on wger CDN.
- **Loose FK on workout_exercises** — add optional `exercise_id` column to `workout_exercises` pointing to the new library. Existing columns are untouched; the link is optional and set by the admin panel.

## Database Schema

### New tables

```sql
exercise_categories (
  id          int PRIMARY KEY,
  name        text NOT NULL
)

muscles (
  id          int PRIMARY KEY,
  name        text NOT NULL,
  is_front    bool NOT NULL DEFAULT true
)

equipment (
  id          int PRIMARY KEY,
  name        text NOT NULL
)

exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en         text NOT NULL,
  description_en  text NOT NULL DEFAULT '',
  name_cs         text,
  description_cs  text,
  category_id     int REFERENCES exercise_categories(id),
  image_url       text,           -- Supabase Storage public URL
  video_url       text,           -- canonical demo video, nullable
  difficulty      text,           -- 'beginner' | 'intermediate' | 'advanced', nullable
  is_active       bool NOT NULL DEFAULT true,
  wger_id         int,            -- import traceability only, nullable
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
)

exercise_muscles (
  exercise_id   uuid REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_id     int REFERENCES muscles(id),
  is_primary    bool NOT NULL DEFAULT true,
  PRIMARY KEY (exercise_id, muscle_id, is_primary)
)

exercise_equipment (
  exercise_id   uuid REFERENCES exercises(id) ON DELETE CASCADE,
  equipment_id  int REFERENCES equipment(id),
  PRIMARY KEY (exercise_id, equipment_id)
)
```

### Modified table

```sql
-- Add to workout_exercises (non-breaking, nullable)
ALTER TABLE workout_exercises
  ADD COLUMN exercise_id uuid REFERENCES exercises(id) ON DELETE SET NULL;
```

### Supabase Storage

New public bucket: `exercises`  
Path pattern: `exercises/{wger_id}-{slug}.png`

## Import Script

Location: `scripts/import-exercises/` (Node.js, one-time use, kept in repo for reference)

**Steps:**
1. Fetch all categories from `/api/v2/exercisecategory/` → insert into `exercise_categories`
2. Fetch all muscles from `/api/v2/muscle/` → insert into `muscles`
3. Fetch all equipment from `/api/v2/equipment/` → insert into `equipment`
4. Paginate `/api/v2/exerciseinfo/?format=json&language=2&limit=100`:
   - Skip exercises with no English translation
   - Extract EN translation (language=2) and CS translation (language=9) if present
   - Strip HTML tags from descriptions
   - Download main image → upload to Supabase Storage `exercises/` bucket
   - Insert exercise row, exercise_muscles rows, exercise_equipment rows
5. Log all skipped exercises (reason: no EN translation / image download failure)

Script is throw-away — runs once against production Supabase project.

## App-side Changes

### What changes

| Before | After |
|--------|-------|
| `ExerciseApiDataSource` (Ktor → wger.de) | `ExerciseSupabaseDataSource` (Supabase Postgrest) |
| `ExerciseRepositoryImpl` uses API datasource | Updated to use Supabase datasource |
| `WgerExercise` domain model | Renamed to `Exercise` |
| `WgerExerciseInfoDto`, `WgerCategoryDto`, etc. | Replaced with `ExerciseDto`, `ExerciseCategoryDto` |
| DI wires HTTP client for exercises | HTTP client dependency removed from exercise DI |
| All `wger*` naming in ViewModels/UseCases/UI | Cleaned up to `exercise*` |

### What stays the same

- `ExerciseRepository` interface — 3 of 4 method signatures unchanged:
  - `searchExercises(query: String): Result<List<Exercise>>`
  - `getCategories(): Result<List<ExerciseCategory>>`
  - `getExercisesByCategory(categoryId: Int): Result<List<Exercise>>`
- All use cases except `GetExerciseByIdUseCase` — zero changes
- All ViewModels except `ExerciseViewModel` (exercise ID type) — zero changes
- All UI screens except `ExerciseDetailScreen` (exercise ID passed as route arg) — zero changes

### What changes due to ID type (Int → String uuid)

`getExerciseById` changes its parameter from `Int` to `String`. This cascades to:
- `ExerciseRepository.getExerciseById(id: String)`
- `GetExerciseByIdUseCase` — parameter type update only
- `ExerciseViewModel` — ID handling update
- `ExerciseDetailScreen` — route argument type update (nav route passes exercise UUID instead of wger Int ID)
- `ExerciseByCategoryScreen` — exercise item click passes UUID instead of Int

### ExerciseSupabaseDataSource queries

- **getCategories**: `SELECT * FROM exercise_categories ORDER BY name`
- **getExercisesByCategory**: `SELECT exercises.*, exercise_muscles, exercise_equipment FROM exercises WHERE category_id = ? AND is_active = true`
- **getExerciseById**: `SELECT ... FROM exercises WHERE id = ?`
- **searchExercises**: `SELECT ... FROM exercises WHERE (name_en ILIKE '%?%' OR name_cs ILIKE '%?%') AND is_active = true LIMIT 20`

Language selection (EN vs CS) happens in the repository mapping layer based on device locale.

## Admin Panel

New **Exercises** tab:

- **List view**: paginated table with search (name), filter by category, columns: image thumbnail, name, category, difficulty, is_active toggle
- **Create/edit form**: name EN, name CS, description EN, description CS, category (dropdown), primary muscles (multi-select), secondary muscles (multi-select), equipment (multi-select), image upload, video URL, difficulty (dropdown), is_active toggle
- **Delete**: soft delete — sets `is_active = false`
- **Workout exercise linking**: when editing a `workout_exercise` entry, admin can optionally select an exercise from the library to populate `exercise_id`

## Out of Scope

- Offline caching / local database (future work)
- More than two languages (future: add column per language)
- User-submitted exercises
- Automatic sync with wger for new exercises
