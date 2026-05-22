# Meal Plan Revamp — Design Spec

**Date:** 2026-05-22  
**Scope:** Admin meal plan editor + mobile meal plan screen  
**Approach:** Single branch, full delivery (DB → admin UI → mobile)

---

## Problem Summary

1. Recipe name chips in the admin meal slot editor show only the ✕ button (name missing).
2. Assigning a meal plan to a user from the UserDetail dropdown silently fails (broken RLS).
3. Meal plans have no weekly structure — no day-of-week concept in the data model.
4. Meal plans can only be assigned to a single user (`meal_plans.user_id`).
5. The admin editor is a cramped modal — not suitable for a 7-day weekly layout.
6. Mobile shows a flat list of all meals with no day filter.

---

## 1. Database Migration

### 1a. Add `day_of_week` to `meals`

```sql
ALTER TABLE meals ADD COLUMN day_of_week INTEGER; -- 0=Mon … 6=Sun, NULL = every day (legacy)
```

Each meal slot belongs to one weekday. Multiple breakfast/lunch/dinner rows per day are allowed.

### 1b. New `user_meal_plans` join table

```sql
CREATE TABLE user_meal_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id  UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, meal_plan_id)
);

ALTER TABLE user_meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own assignments"
  ON user_meal_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage assignments"
  ON user_meal_plans FOR ALL TO authenticated
  USING (is_admin());

CREATE INDEX idx_ump_user ON user_meal_plans(user_id);
CREATE INDEX idx_ump_plan ON user_meal_plans(meal_plan_id);
```

`meal_plans.user_id` column is kept but no longer written to. No breaking change for existing data.

### 1c. Fix broken RLS policies

Current policies on `meal_plans`, `meals`, `meal_plan_recipes` gate admin writes on `coach_id = auth.uid()`. Because `coach_id` is never set by the admin UI, all mutations silently fail. Replace with `is_admin()` pattern used by every other admin-managed table.

```sql
-- meal_plans: admin full access
DROP POLICY IF EXISTS "Admins can manage meal plans" ON meal_plans;
CREATE POLICY "Admins manage meal plans"
  ON meal_plans FOR ALL TO authenticated USING (is_admin());

-- meal_plans: user read — join table aware
DROP POLICY IF EXISTS "Users can read assigned meal plans" ON meal_plans;
CREATE POLICY "Users read assigned meal plans"
  ON meal_plans FOR SELECT
  USING (
    user_id IS NULL  -- global templates (legacy)
    OR EXISTS (
      SELECT 1 FROM user_meal_plans ump
      WHERE ump.meal_plan_id = id AND ump.user_id = auth.uid()
    )
  );

-- meals: admin full access
DROP POLICY IF EXISTS "Admins can manage meals" ON meals;
CREATE POLICY "Admins manage meals"
  ON meals FOR ALL TO authenticated USING (is_admin());

-- meals: user read — join table aware
DROP POLICY IF EXISTS "Users can read meals for accessible plans" ON meals;
CREATE POLICY "Users read meals for accessible plans"
  ON meals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id
      AND (
        mp.user_id IS NULL
        OR EXISTS (SELECT 1 FROM user_meal_plans ump WHERE ump.meal_plan_id = mp.id AND ump.user_id = auth.uid())
      )
    )
  );

-- meal_foods: user read — join table aware
DROP POLICY IF EXISTS "Users can read meal foods for accessible plans" ON meal_foods;
CREATE POLICY "Users read meal foods for accessible plans"
  ON meal_foods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meals m
      JOIN meal_plans mp ON mp.id = m.meal_plan_id
      WHERE m.id = meal_id
      AND (
        mp.user_id IS NULL
        OR EXISTS (SELECT 1 FROM user_meal_plans ump WHERE ump.meal_plan_id = mp.id AND ump.user_id = auth.uid())
      )
    )
  );

-- meal_plan_recipes: admin full access
DROP POLICY IF EXISTS "Admin manages meal plan recipes" ON meal_plan_recipes;
CREATE POLICY "Admins manage meal plan recipes"
  ON meal_plan_recipes FOR ALL TO authenticated USING (is_admin());
```

---

## 2. Admin UI

### 2a. Route changes

| Before | After |
|--------|-------|
| Modal inside `Nutrition.tsx` | `/admin/nutrition/meal-plans/new` |
| Modal inside `Nutrition.tsx` | `/admin/nutrition/meal-plans/:id` |

`MealPlansTab` in `Nutrition.tsx` becomes a list-only view. "Edit" and "+ Create meal plan" navigate to the new routes. The old modal is removed.

`UserDetail.tsx` — the standalone "Assign Meal Plan" dropdown is removed. Assignment is managed exclusively from the meal plan editor.

### 2b. New file: `MealPlanEditor.tsx`

**Page layout (top → bottom):**

```
← Meal Plans   [Plan name — inline Input]   [Assigned Users (N)]   [Save]
────────────────────────────────────────────────────────────────────────────
Description (optional Input)

[Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]   ← day tabs
────────────────────────────────────────────────────────────────────────────
  BREAKFAST                 LUNCH                  DINNER
  ─────────                 ─────                  ──────
  Overnight Oats  ✕         Chicken Salad  ✕        + add recipe ▾
  Greek Yogurt    ✕         Brown Rice     ✕
  + add recipe ▾            + add recipe ▾
```

Valid-from / valid-to fields are removed entirely.

**Draft state shape:**

```ts
interface RecipeDraft { recipe_id: string; recipe_name: string }
interface MealDraft   {
  day_of_week: number            // 0 = Mon … 6 = Sun
  meal_type: 'breakfast' | 'lunch' | 'dinner'
  recipes: RecipeDraft[]
}
// 21 entries total: initialised as empty, filled from DB on edit
```

Recipe name stored at add-time (fixes the "only ✕" chip bug — no lookup needed at render).

**Save logic:**
1. Upsert `meal_plans` row (name, description).
2. Delete all existing `meals` + `meal_plan_recipes` for this plan.
3. Insert non-empty `MealDraft` entries as `meals` rows with `day_of_week` and `name` = capitalised `meal_type`.
4. Insert `meal_plan_recipes` for each recipe in each meal.
5. Diff current vs previous `user_meal_plans` entries: insert new, delete removed.

### 2c. Assign Users dialog

Triggered by the "Assigned Users (N)" button. Rendered as a `Modal`.

- **Search field** — filters the user list client-side (debounced).
- **Filter toggle** — "All" / "Assigned only" — toggles between full list and assigned subset.
- **User list** — paginated (10 per page). Each row: avatar initial, full name, email, checkbox. Assigned rows float to the top with a green-tinted background.
- **Footer** — "N assigned" count on the left, "Done" button on the right.

When opening an existing plan, the editor fetches current `user_meal_plans` rows for that plan to pre-populate the assigned-users list.

Changes are applied to local state only; they are committed to `user_meal_plans` when the main "Save" button is pressed.

### 2d. Meal plan list table changes

Remove "Valid from" and "Valid to" columns. Add "Assigned to" column showing the count of users assigned to each plan (queried from `user_meal_plans`).

---

## 3. Mobile

### 3a. Domain model

`Meal` gains `dayOfWeek: Int?`:

```kotlin
data class Meal(
    val id: String,
    val mealPlanId: String,
    val name: String,
    val timeOfDay: String?,
    val sortOrder: Int,
    val dayOfWeek: Int?,   // new — 0=Mon … 6=Sun, null = every day
    val foods: List<MealFood>
)
```

`MealDto` gains `@SerialName("day_of_week") val dayOfWeek: Int? = null`.

### 3b. State & intent

```kotlin
// NutritionState
val selectedDayOfWeek: Int  // default = today's ISO weekday index (Mon=0)

// NutritionIntent
data class SelectDay(val dayOfWeek: Int) : NutritionIntent
```

ViewModel initialises `selectedDayOfWeek` using `Clock.System.now()` → `LocalDate.dayOfWeek.isoDayNumber - 1`.

On `SelectDay`: update state, filter meals.

### 3c. `MealPlanDetailScreen` refactor

**Layout (top → bottom):**

```
MEAL PLAN
─────────────────────────────────────────────
[M]  [T]  [W]  [T]  [F]  [S]  [S]
      ↑ today (filled circle)
─────────────────────────────────────────────
  1840 kcal  ·  142g protein  ·  180g carbs  ·  62g fat
─────────────────────────────────────────────
BREAKFAST                               08:00
Overnight Oats · Greek Yogurt
480 kcal · 32g protein

LUNCH                                   12:30
Chicken Salad · Brown Rice
720 kcal · 58g protein

DINNER
Salmon & Vegetables
640 kcal · 52g protein
─────────────────────────────────────────────
[RECORD MEAL]
```

Day strip is a `LazyRow` of 7 tappable day chips. Tapping updates `selectedDayOfWeek` via intent.

Macro summary row derives totals from `filteredMeals` (meals matching `selectedDayOfWeek`).

Meal cards show recipe names joined with `·` separator, plus combined kcal and protein for the slot.

### 3d. Data source

`getActiveMealPlan` currently runs two explicit queries filtering by `user_id`. With `meal_plans.user_id` deprecated, those filters return nothing. Simplify to a single query — the updated RLS policy handles filtering transparently:

```kotlin
suspend fun getActiveMealPlan(userId: String): MealPlanDto? =
    supabase.postgrest["meal_plans"]
        .select(columns = Columns.raw("*, meals(*, meal_foods(*))")) {
            filter { eq("is_active", true) }
            limit(1)
        }
        .decodeList<MealPlanDto>()
        .firstOrNull()
```

The new `day_of_week` field on `meals` is returned automatically once the column exists.

---

## Files Touched

### Supabase
- `supabase/migrations/20260522000000_meal_plan_weekly.sql` — new migration

### Admin
- `admin/src/pages/admin/Nutrition.tsx` — remove meal plan editor modal, list-only
- `admin/src/pages/admin/MealPlanEditor.tsx` — new full-page editor
- `admin/src/pages/admin/UserDetail.tsx` — remove broken meal plan dropdown
- `admin/src/App.tsx` — add two new routes
- `admin/src/types/database.ts` — no changes needed

### Mobile (composeApp)
- `NutritionDto.kt` — add `day_of_week` to `MealDto`
- `Nutrition.kt` — add `dayOfWeek: Int?` to `Meal`
- `NutritionState.kt` — add `selectedDayOfWeek: Int`
- `NutritionIntent.kt` — add `SelectDay` intent
- `NutritionViewModel.kt` — handle `SelectDay`, default to today
- `MealPlanDetailScreen.kt` — day strip + macro summary card
