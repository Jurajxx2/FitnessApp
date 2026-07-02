# Build-Now MVP Implementation Plan (app + admin, end-to-end)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Coach Foska app + React admin MVP-present-ready per `coach-foska-build-now-spec.md`: unified design system, dashboard metrics, user-authored workouts with substitution and fork-on-modify, live-session autosave/resume with a set-completion signature interaction, recipes polish + admin featured toggle, Me-tab alignment, Czech-default i18n.

**Architecture:** Existing Clean Architecture KMP app (`:composeApp`, package `com.coachfoska.app`, layers `ui/ presentation/ domain/ data/ core/`), Supabase Postgrest backend (online-only, no local DB), Koin DI, typesafe Navigation. Admin is React 19 + Vite + Tailwind 4 + @tanstack/react-query + supabase-js in `admin/`. New workout model: coach plans stay read-only; user plans are rows in the existing `workouts` table with `source='user'` + `owner_user_id`; modifying a coach plan forks it (`forked_from_workout_id`). Live sessions write `workout_logs` with `status='in_progress'` and autosave each set to `set_logs`.

**Tech Stack:** Kotlin 2.3.10, Compose Multiplatform 1.10.2, Koin 4.1.1, Ktor 3.4.1, Supabase-kt 3.4.1, kotlinx-datetime, Napier. Admin: React 19, TS 5.8, Vite 6, Tailwind 4, vitest.

## Global Constraints

- Do NOT build: check-ins, coach comments, chat extensions, photo-AI meal analysis, offline/local DB, coach screens in the app, role gating, new exercise sources (spec §9). If a task seems to require one — stop and flag.
- Online-only via Postgrest. Network errors surface with retry; never silent data loss (especially set logging).
- All new UI strings go to `composeApp/src/commonMain/composeResources/values/strings.xml` (EN for now; Task 13 makes Czech the default). No hardcoded UI strings in new/modified code.
- Week starts Monday (CZ). Weight unit is kg (from profile; never hardcode a conversion).
- Touch targets ≥ 48dp. The set-completion animation must honor reduce-motion.
- Onboarding: visual alignment ONLY — do not touch its logic (spec §1).
- All `./gradlew` commands are pre-approved (CLAUDE.md).
- git: stage explicit paths only — NEVER `git add -A` or `git add .` (repo has untracked cruft).
- Verify compile with `./gradlew :composeApp:compileDebugKotlinAndroid -q` (baseline passes as of plan time). Unit tests: `./gradlew :composeApp:testDebugUnitTest -q`.
- Existing tests live in `composeApp/src/commonTest/` (61 test files) — follow their style (kotlin.test, fake repositories).
- Theme lives at `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/` (NOT `core/theme/` as the spec assumed — accepted drift; keep it there).

## Ground-truth audit results (drift report, verified 2026-07-02)

Verified against real files — executors can trust this section:

- `workouts(id, coach_id, user_id NULL=all, name, day_of_week 0=Mon, duration_minutes, notes, is_active)`; `workout_exercises(id, workout_id, name, muscle_group, sets, reps TEXT, rest_seconds, tips, video_url, sort_order, exercise_id UUID?)`. `user_workouts(user_id, workout_id)` is an **assignment join table only** — there is NO instance layer yet.
- `workout_logs(id, user_id, workout_id?, workout_name, duration_minutes, notes, logged_at)` → `exercise_logs(id, workout_log_id, exercise_name, notes, video_url, legacy flat fields)` → `set_logs(id, exercise_log_id, sort_order, target/actual reps+weight, rpe, target/actual rest, completed)`. No `status` column yet.
- App fetches assigned workouts three ways (global `user_id IS NULL` + legacy `user_id=me` + `user_workouts` join) and dedupes — see `WorkoutRemoteDataSource.getAssignedWorkouts`.
- Live session (`ActiveSessionViewModel`) already has: prefill from last session, rest timer (skip/adjust), PR detection + banner, auto-advance, add/remove sets. It submits everything **once at the end** — no per-set autosave, no resume.
- No user-created workouts, no substitution anywhere.
- Theme: `theme/Color.kt` (black/white/BrandRed `0xFFA90707` palette), `Theme.kt` (M3 dark+light schemes, shape scale 4–12dp), `Type.kt` (full M3 type scale, ExtraBold display). No spacing tokens, no chart/data-viz roles, no `metric` styles.
- Shared components: only `CoachButton`, `CoachTextField`, `CoachSectionHeader`, `CoachLoadingBox` (in `ui/components/CoachComponents.kt`) + `CoachTopBar`. No MetricCard/EmptyState/shimmer/chips.
- i18n: single `values/strings.xml`, English, 248 strings; ~60 hardcoded `Text("...")` sites remain (worst: `ActivityHubScreen`, `WorkoutPlanScreen`, `RecipesListScreen` tab labels).
- Recipes: full list/detail with favorites, servings scaling, step cards — wired and working. `recipes.featured BOOLEAN` column exists; app renders featured in `NutritionHubScreen`; **admin has no featured toggle** (gap).
- Admin is far along: OTP login + admin gate, Dashboard, Users + UserDetail (profile edit, weight history, 7-day logs, onboarding answers, single workout + meal-plan assignment), Workouts CRUD + exercise combobox/browser + multi-user assignment, Nutrition (meal plans CRUD/editor/import; recipes CRUD incl. steps + photo upload + import), Exercises import, Quotes, Chat.
- `get_is_admin()` SQL helper exists (used by `user_workouts` policies).
- Uncommitted working-tree change: `ActivityLogViewModel.kt` blank-userId guard (committed in Task 0).

---

### Task 0: Commit the pending working-tree fix

**Files:**
- Commit only: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/activity/ActivityLogViewModel.kt`

- [ ] **Step 1: Verify the diff is only the blank-userId guard**

Run: `git diff composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/activity/ActivityLogViewModel.kt`
Expected: 3 small hunks adding `if (userId.isBlank()) return` / `isNotBlank()` guards, nothing else.

- [ ] **Step 2: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/activity/ActivityLogViewModel.kt
git commit -m "fix(activity): guard ActivityLogViewModel against blank userId"
```

---

### Task 1: DB migration — user workouts, substitution, session status

**Files:**
- Create: `supabase/migrations/20260702000000_user_workouts_substitution_sessions.sql`

**Interfaces:**
- Produces columns consumed by Tasks 5, 8, 9: `workouts.source/owner_user_id/forked_from_workout_id`, `workout_exercises.substituted_from_exercise_id/substituted_from_name`, `exercise_logs.exercise_id/substituted_from_exercise_id/substituted_from_name`, `workout_logs.status`.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Preferred: Supabase MCP `apply_migration` with name `user_workouts_substitution_sessions` and the SQL above. Fallback: `supabase db push` if the CLI is linked. If neither is available in your environment, STOP and report — later tasks depend on these columns existing remotely.

- [ ] **Step 3: Smoke-check via SQL**

Run (MCP `execute_sql` or SQL editor): `SELECT source, owner_user_id, forked_from_workout_id FROM workouts LIMIT 1;` and `SELECT status FROM workout_logs LIMIT 1;`
Expected: columns exist, no error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260702000000_user_workouts_substitution_sessions.sql
git commit -m "feat(db): user-authored workouts, substitution records, resumable session status"
```

---

### Task 2: Design tokens — spacing, semantic/data-viz color, metric type

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/Dimens.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/Color.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/Type.kt`

**Interfaces:**
- Produces (consumed by every UI task): `Spacing.xs/sm/md/lg/xl/xxl` (4/8/12/16/24/32.dp), `Sizes.touchTarget` (48.dp), `ChartLine`, `ChartFill`, `Warning`, `TextAccent`, `muscleGroupColor(label: String): Color`, `MetricLarge`/`MetricMedium`/`MetricSmall` TextStyles.

- [ ] **Step 1: Create Dimens.kt**

```kotlin
package com.coachfoska.app.theme

import androidx.compose.ui.unit.dp

// Fixed spacing scale (spec §2.2) — reference these everywhere; no ad-hoc dp values.
object Spacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 24.dp
    val xxl = 32.dp
}

object Sizes {
    /** Accessibility floor: minimum touch target (spec §7). */
    val touchTarget = 48.dp
}
```

- [ ] **Step 2: Extend Color.kt** — append below the existing declarations (keep everything already there):

```kotlin
// Functional (extended)
val Warning = Color(0xFFF9A825)

// Text accent — BrandRed fails AA for small text on black (~2.4:1).
// Use TextAccent for red text; reserve BrandRed for icons, fills and large numerals.
val TextAccent = BrandRedLight

// Data-viz roles (spec §2.2) — one chart recipe across Dashboard and Me.
val ChartLine = BrandRed
val ChartFill = Color(0x26A90707) // BrandRed @ 15%
val ChartGrid = Color(0x14FFFFFF) // white @ 8%

// Muscle-group category colors — muted, distinguishable on black.
private val MuscleGroupPalette = listOf(
    Color(0xFFCF2E2E), // red     — chest
    Color(0xFF5B8DEF), // blue    — back
    Color(0xFFE3A13B), // amber   — legs
    Color(0xFF58B368), // green   — shoulders
    Color(0xFFB06AC9), // purple  — arms
    Color(0xFF4FB6C4), // teal    — core
)

fun muscleGroupColor(label: String?): Color {
    if (label.isNullOrBlank()) return Gray500
    val idx = label.lowercase().hashCode().mod(MuscleGroupPalette.size)
    return MuscleGroupPalette[idx]
}
```

- [ ] **Step 3: Extend Type.kt** — append below `CoachFoskaTypography`:

```kotlin
// Metric styles (spec §2.2): stat readouts are the app's visual signature —
// oversized, extra-bold, tight tracking, tabular feel. Body stays neutral/legible
// (system sans); display numerals carry the personality, mirroring the PP Mori
// black/white brand on coachfoska.com.
val MetricLarge = TextStyle(
    fontWeight = FontWeight.ExtraBold,
    fontSize = 44.sp,
    lineHeight = 48.sp,
    letterSpacing = (-1.5).sp
)

val MetricMedium = TextStyle(
    fontWeight = FontWeight.ExtraBold,
    fontSize = 28.sp,
    lineHeight = 32.sp,
    letterSpacing = (-0.5).sp
)

val MetricSmall = TextStyle(
    fontWeight = FontWeight.Bold,
    fontSize = 18.sp,
    lineHeight = 22.sp,
    letterSpacing = 0.sp
)
```

- [ ] **Step 4: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid -q`
Expected: BUILD SUCCESSFUL (no output with -q).

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/
git commit -m "feat(theme): spacing scale, data-viz color roles, metric type styles"
```

---

### Task 3: Shared components — MetricCard, EmptyState, shimmer, chips, StatRow, SectionHeader

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/MetricCard.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/EmptyState.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/Shimmer.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/StatRow.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/SectionHeader.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/FoskaChip.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.kt` (+ androidMain/iosMain actuals)

**Interfaces (consumed by Tasks 4, 6, 7, 8, 9, 10, 11):**
- `@Composable fun MetricCard(value: String, label: String, modifier: Modifier = Modifier, delta: String? = null, deltaPositive: Boolean? = null, animateValue: Boolean = true, onClick: (() -> Unit)? = null)`
- `@Composable fun EmptyState(icon: ImageVector, title: String, message: String, modifier: Modifier = Modifier, actionLabel: String? = null, onAction: (() -> Unit)? = null)`
- `@Composable fun ShimmerBox(modifier: Modifier)` and `@Composable fun MetricCardSkeleton(modifier: Modifier = Modifier)`
- `@Composable fun StatRow(label: String, value: String, modifier: Modifier = Modifier)`
- `@Composable fun SectionHeader(title: String, modifier: Modifier = Modifier, actionLabel: String? = null, onAction: (() -> Unit)? = null)`
- `@Composable fun FoskaFilterChip(selected: Boolean, label: String, onClick: () -> Unit, modifier: Modifier = Modifier, leadingIcon: ImageVector? = null)`
- `expect fun platformReduceMotionEnabled(): Boolean` + `val LocalReduceMotion = staticCompositionLocalOf { false }` (provided in `App.kt` root)

- [ ] **Step 1: Create ReduceMotion.kt (expect/actual)**

`composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.kt`:
```kotlin
package com.coachfoska.app.core.util

import androidx.compose.runtime.staticCompositionLocalOf

/** True when the OS asks apps to minimise motion. Checked once per app launch. */
expect fun platformReduceMotionEnabled(): Boolean

val LocalReduceMotion = staticCompositionLocalOf { false }
```

`composeApp/src/androidMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.android.kt`:
```kotlin
package com.coachfoska.app.core.util

import android.provider.Settings
import com.coachfoska.app.CoachFoskaApp   // verify actual Application class name; if none exported, fall back to a Context holder already used in androidMain (search for "actual fun" with Context usage and mirror that pattern)

actual fun platformReduceMotionEnabled(): Boolean = runCatching {
    val resolver = CoachFoskaApp.instance.contentResolver
    Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
}.getOrDefault(false)
```
NOTE: check how other androidMain actuals obtain a Context (grep `androidMain` for `actual fun`) and reuse that exact pattern; if no Application singleton exists, add `ANIMATOR_DURATION_SCALE` reading via `AndroidApp` context holder used by MediaCapture (see `core/util/MediaCapture.kt` androidMain actual).

`composeApp/src/iosMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.ios.kt`:
```kotlin
package com.coachfoska.app.core.util

import platform.UIKit.UIAccessibilityIsReduceMotionEnabled

actual fun platformReduceMotionEnabled(): Boolean = UIAccessibilityIsReduceMotionEnabled()
```

In `App.kt`, wrap the theme content root once:
```kotlin
CompositionLocalProvider(LocalReduceMotion provides remember { platformReduceMotionEnabled() }) { /* existing content */ }
```

- [ ] **Step 2: Create MetricCard.kt** — the workhorse (spec §2.3). Numbers count up unless reduce-motion:

```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.sp
import com.coachfoska.app.core.util.LocalReduceMotion
import com.coachfoska.app.theme.MetricMedium
import com.coachfoska.app.theme.Spacing
import com.coachfoska.app.theme.TextAccent

/**
 * Big number + label + optional trend delta. If [value] is purely numeric and
 * [animateValue] is true, the number counts up on first composition (spec §2.4:
 * effort-as-data — numbers in motion), skipped under reduce-motion.
 */
@Composable
fun MetricCard(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    delta: String? = null,
    deltaPositive: Boolean? = null,
    animateValue: Boolean = true,
    onClick: (() -> Unit)? = null,
) {
    val reduceMotion = LocalReduceMotion.current
    val numeric = remember(value) { value.toIntOrNull() }
    val displayed: String = if (numeric != null && animateValue && !reduceMotion) {
        val animated by animateIntAsState(
            targetValue = numeric,
            animationSpec = tween(durationMillis = 700),
            label = "metric-countup",
        )
        animated.toString()
    } else value

    Surface(
        onClick = onClick ?: {},
        enabled = onClick != null,
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            Text(
                text = displayed,
                style = MetricMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = label.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    letterSpacing = 1.sp,
                )
                if (delta != null) {
                    Spacer(Modifier.width(Spacing.sm))
                    Text(
                        text = delta,
                        style = MaterialTheme.typography.labelSmall,
                        color = when (deltaPositive) {
                            true -> com.coachfoska.app.theme.Success
                            false -> TextAccent
                            null -> MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
        }
    }
}
```
(Add the missing `androidx.compose.ui.unit.dp` import.)

- [ ] **Step 3: Create EmptyState.kt**

```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.coachfoska.app.theme.Spacing

/** One empty treatment for every screen (spec §2.3) — icon + title + message + optional action. */
@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = Spacing.xl, vertical = Spacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        if (actionLabel != null && onAction != null) {
            CoachButton(text = actionLabel, onClick = onAction, modifier = Modifier.padding(top = Spacing.sm))
        }
    }
}
```
(Check `CoachButton`'s exact signature in `ui/components/CoachComponents.kt` before use; adjust the call to match.)

- [ ] **Step 4: Create Shimmer.kt** — one shimmer treatment:

```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.coachfoska.app.core.util.LocalReduceMotion
import com.coachfoska.app.theme.Spacing
import androidx.compose.material3.MaterialTheme

/** Single shimmer recipe (spec §2.3). Static placeholder under reduce-motion. */
@Composable
fun ShimmerBox(modifier: Modifier) {
    val base = MaterialTheme.colorScheme.surfaceVariant
    if (LocalReduceMotion.current) {
        Spacer(modifier.clip(MaterialTheme.shapes.medium).background(base))
        return
    }
    val transition = rememberInfiniteTransition(label = "shimmer")
    val x by transition.animateFloat(
        initialValue = -300f, targetValue = 900f,
        animationSpec = infiniteRepeatable(tween(1100, easing = LinearEasing), RepeatMode.Restart),
        label = "shimmer-x",
    )
    val brush = Brush.linearGradient(
        colors = listOf(base, base.copy(alpha = 0.4f), base),
        start = Offset(x, 0f), end = Offset(x + 300f, 80f),
    )
    Spacer(modifier.clip(MaterialTheme.shapes.medium).background(brush))
}

@Composable
fun MetricCardSkeleton(modifier: Modifier = Modifier) {
    Column(modifier = modifier.padding(Spacing.lg)) {
        ShimmerBox(Modifier.fillMaxWidth(0.5f).height(32.dp))
        Spacer(Modifier.height(Spacing.sm))
        ShimmerBox(Modifier.fillMaxWidth(0.8f).height(12.dp))
    }
}
```

- [ ] **Step 5: Create StatRow.kt, SectionHeader.kt, FoskaChip.kt**

`StatRow.kt`:
```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.coachfoska.app.theme.Spacing

@Composable
fun StatRow(label: String, value: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth().padding(vertical = Spacing.sm),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
    }
}
```

`SectionHeader.kt` (unifies `ActivityHubScreen`'s private SectionHeader + `CoachSectionHeader`):
```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title.uppercase(),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
            letterSpacing = 1.5.sp,
        )
        if (actionLabel != null && onAction != null) {
            Text(
                text = actionLabel.uppercase(),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                letterSpacing = 1.sp,
                modifier = Modifier.clickable(onClick = onAction),
            )
        }
    }
}
```

`FoskaChip.kt`:
```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector

@Composable
fun FoskaFilterChip(
    selected: Boolean,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        modifier = modifier,
        label = { Text(label, style = MaterialTheme.typography.labelLarge) },
        leadingIcon = leadingIcon?.let {
            { Icon(it, contentDescription = null, Modifier.size(FilterChipDefaults.IconSize)) }
        },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.primary,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
            selectedLeadingIconColor = MaterialTheme.colorScheme.onPrimary,
        ),
    )
}
```

- [ ] **Step 6: Compile, then commit**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid -q` → BUILD SUCCESSFUL.

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/ composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.kt composeApp/src/androidMain/kotlin/com/coachfoska/app/core/util/ composeApp/src/iosMain/kotlin/com/coachfoska/app/core/util/ composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
git commit -m "feat(ui): shared design-system components (MetricCard, EmptyState, shimmer, chips)"
```

---

### Task 4: Dashboard — metrics row, first-run guidance, per-card retry

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeState.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt` (+ `HomeIntent.kt`)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` (HomeViewModel deps)
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Test: `composeApp/src/commonTest/kotlin/com/coachfoska/app/presentation/home/HomeViewModelMetricsTest.kt`

**Interfaces:**
- Consumes: `MetricCard`, `MetricCardSkeleton`, `EmptyState`, `SectionHeader`, `Spacing` (Task 2/3); `GetWeightHistoryUseCase(userId): Result<List<WeightEntry>>`; `WorkoutRepository.getCurrentStreak(userId): Result<Int>` (existing).
- Produces: `HomeState.weekWorkoutsDone: Int`, `currentWeightKg: Float?`, `weightDeltaKg: Float?`, `streakWeeks: Int`, `isFirstRun: Boolean`, `metricsError: Boolean`; `HomeIntent.RetryMetrics`.

- [ ] **Step 1: Read `HomeViewModel.kt` + `HomeIntent.kt` fully** (they were not audited line-by-line) to see how `loadData` is structured — extend, don't restructure.

- [ ] **Step 2: Write the failing test**

`HomeViewModelMetricsTest.kt` — follow the existing fake-repo test style in `commonTest` (find an existing `HomeViewModel` test first; if one exists, extend it instead of a new file):
```kotlin
@Test
fun weekWorkoutsDone_counts_logs_since_monday_only() { /* seed fake WorkoutRepository with
    2 completed logs this week (after Monday 00:00 local) + 1 last week; assert state.weekWorkoutsDone == 2 */ }

@Test
fun firstRun_is_true_when_no_history_and_no_assigned_workouts() { /* empty fakes → assert isFirstRun */ }

@Test
fun weightDelta_is_latest_minus_entry_closest_to_30_days_ago() { /* entries 80.0 (today), 82.5 (35d ago) → delta == -2.5f */ }
```
Write real assertions with the project's fakes (kotlin.test + runTest). Run: `./gradlew :composeApp:testDebugUnitTest -q --tests "*HomeViewModelMetricsTest*"` → FAIL (fields don't exist).

- [ ] **Step 3: Implement state + loading**

Add to `HomeState`:
```kotlin
val weekWorkoutsDone: Int = 0,
val currentWeightKg: Float? = null,
val weightDeltaKg: Float? = null,
val streakWeeks: Int = 0,
val isFirstRun: Boolean = false,
val metricsError: Boolean = false,
```
In `HomeViewModel`, inject `GetWeightHistoryUseCase` and `WorkoutRepository` (match constructor-order in `AppModule.kt` line ~236). Compute inside the existing load flow (do NOT blank the whole screen when only metrics fail — set `metricsError = true` instead, other cards render):
```kotlin
// Week window: Monday 00:00 local (spec §7 — week starts Monday, CZ)
val today = todayDate()
val monday = today.minus(DatePeriod(days = today.dayOfWeek.isoDayNumber - 1))
val weekDone = history.count { it.loggedAt.toLocalDateTime(TimeZone.currentSystemDefault()).date >= monday }
```
Weight: latest entry = current; delta vs the entry closest to 30 days back (null when <2 entries). Streak: `workoutRepository.getCurrentStreak(userId)`. `isFirstRun = history.isEmpty() && state.workouts.isEmpty()`.
Add `HomeIntent.RetryMetrics` → re-runs just the metrics loads.

- [ ] **Step 4: Run the test** → PASS.

- [ ] **Step 5: UI — metrics row + first-run**

In `HomeScreen.kt`, below the header and above Weekly Activity insert (new strings in resources: `home_metric_week_workouts` "This week", `home_metric_weight` "Weight", `home_metric_streak` "Week streak", `home_first_run_title` "Start your first workout", `home_first_run_message` "Your coach plan is waiting — or build your own.", `home_first_run_action` "Go to workouts", `home_metrics_retry` "Retry"):
```kotlin
if (state.isFirstRun) {
    EmptyState(
        icon = Icons.Default.FitnessCenter,
        title = stringResource(Res.string.home_first_run_title),
        message = stringResource(Res.string.home_first_run_message),
        actionLabel = stringResource(Res.string.home_first_run_action),
        onAction = onGoToActivity,   // new lambda param wired in App.kt to select Activity tab
    )
} else {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
        MetricCard(
            value = state.weekWorkoutsDone.toString(),
            label = stringResource(Res.string.home_metric_week_workouts),
            modifier = Modifier.weight(1f),
        )
        MetricCard(
            value = state.currentWeightKg?.let { formatWeightKg(it) } ?: "--",
            label = stringResource(Res.string.home_metric_weight),
            delta = state.weightDeltaKg?.let { (if (it > 0) "+" else "") + formatWeightKg(it) },
            deltaPositive = state.weightDeltaKg?.let { it <= 0f }, // losing weight reads positive for most goals; keep neutral color if null
            animateValue = false,
            modifier = Modifier.weight(1f),
        )
        MetricCard(
            value = state.streakWeeks.toString(),
            label = stringResource(Res.string.home_metric_streak),
            modifier = Modifier.weight(1f),
        )
    }
    if (state.metricsError) {
        TextButton(onClick = { onIntent(HomeIntent.RetryMetrics) }) { Text(stringResource(Res.string.home_metrics_retry)) }
    }
}
```
While `state.isLoading`: render a `Row` of three `MetricCardSkeleton(Modifier.weight(1f))` instead of the old single `CoachLoadingBox` (keep CoachLoadingBox for the rest if simpler). Also fix the 40dp water quick-add IconButton → `Modifier.size(Sizes.touchTarget)`.

- [ ] **Step 6: Compile + full test run** — `./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest -q` → PASS.

- [ ] **Step 7: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/ composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/ composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt composeApp/src/commonMain/composeResources/values/strings.xml composeApp/src/commonTest/kotlin/com/coachfoska/app/presentation/home/ composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
git commit -m "feat(home): metrics row (week count, weight trend, streak), first-run guidance, per-card retry"
```

---

### Task 5: Workout data layer — user plans, fork, substitution records

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Workout.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/WorkoutDto.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/WorkoutRemoteDataSource.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/WorkoutRepository.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/WorkoutRepositoryImpl.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/SaveUserWorkoutUseCase.kt`, `DeleteUserWorkoutUseCase.kt`, `ForkWorkoutUseCase.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`
- Test: `composeApp/src/commonTest/kotlin/com/coachfoska/app/data/WorkoutPlanShadowingTest.kt`

**Interfaces (consumed by Tasks 6, 7, 8):**
```kotlin
enum class WorkoutSource { COACH, USER }

// Workout gains:
val source: WorkoutSource = WorkoutSource.COACH,
val ownerUserId: String? = null,
val forkedFromWorkoutId: String? = null,

// WorkoutExercise gains:
val substitutedFromExerciseId: String? = null,
val substitutedFromName: String? = null,

data class WorkoutExerciseDraft(
    val exerciseId: String?, val name: String, val muscleGroup: String?,
    val sets: Int, val reps: String, val restSeconds: Int, val tips: String? = null,
    val substitutedFromExerciseId: String? = null, val substitutedFromName: String? = null,
)
data class WorkoutDraft(
    val name: String, val dayOfWeek: DayOfWeek?, val notes: String?,
    val exercises: List<WorkoutExerciseDraft>,
)

// WorkoutRepository gains:
suspend fun createUserWorkout(userId: String, draft: WorkoutDraft, forkedFromWorkoutId: String? = null): Result<Workout>
suspend fun updateUserWorkout(workoutId: String, draft: WorkoutDraft): Result<Workout>
suspend fun deleteUserWorkout(workoutId: String): Result<Unit>
```
- `getAssignedWorkouts` result now also contains the user's own plans; plans whose id appears in another returned plan's `forkedFromWorkoutId` are filtered out (fork shadows its source).

- [ ] **Step 1: Write the failing shadowing test**

```kotlin
class WorkoutPlanShadowingTest {
    @Test
    fun fork_shadows_its_source_plan() {
        val coach = workout(id = "c1", source = WorkoutSource.COACH)
        val fork = workout(id = "u1", source = WorkoutSource.USER, forkedFromWorkoutId = "c1")
        val other = workout(id = "c2", source = WorkoutSource.COACH)
        assertEquals(listOf(fork, other), shadowForks(listOf(coach, fork, other)))
    }
}
```
Put `shadowForks` in the repository impl file as an internal top-level function:
```kotlin
internal fun shadowForks(workouts: List<Workout>): List<Workout> {
    val forkedIds = workouts.mapNotNull { it.forkedFromWorkoutId }.toSet()
    return workouts.filter { it.id !in forkedIds }
}
```
Run: `./gradlew :composeApp:testDebugUnitTest -q --tests "*WorkoutPlanShadowingTest*"` → FAIL first, then add code → PASS.

- [ ] **Step 2: Domain model + DTO changes**

`WorkoutDto` gains `source: String = "coach"`, `@SerialName("owner_user_id") ownerUserId: String? = null`, `@SerialName("forked_from_workout_id") forkedFromWorkoutId: String? = null` and maps them in `toDomain()` (`WorkoutSource.USER` when `source == "user"`). `WorkoutExerciseDto` gains `@SerialName("substituted_from_exercise_id")` + `@SerialName("substituted_from_name")`. Add insert DTOs:
```kotlin
@Serializable
data class WorkoutInsertDto(
    val name: String,
    @SerialName("day_of_week") val dayOfWeek: Int? = null,
    @SerialName("duration_minutes") val durationMinutes: Int = 0,
    val notes: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    val source: String = "user",
    @SerialName("owner_user_id") val ownerUserId: String,
    @SerialName("user_id") val userId: String,   // keeps own plans out of the global (user_id IS NULL) feed
    @SerialName("forked_from_workout_id") val forkedFromWorkoutId: String? = null,
)

@Serializable
data class WorkoutUpdateDto(
    val name: String,
    @SerialName("day_of_week") val dayOfWeek: Int? = null,
    val notes: String? = null,
)

@Serializable
data class WorkoutExerciseInsertDto(
    @SerialName("workout_id") val workoutId: String,
    val name: String,
    @SerialName("muscle_group") val muscleGroup: String? = null,
    val sets: Int,
    val reps: String,
    @SerialName("rest_seconds") val restSeconds: Int,
    val tips: String? = null,
    @SerialName("sort_order") val sortOrder: Int,
    @SerialName("exercise_id") val exerciseId: String? = null,
    @SerialName("substituted_from_exercise_id") val substitutedFromExerciseId: String? = null,
    @SerialName("substituted_from_name") val substitutedFromName: String? = null,
)
```

- [ ] **Step 3: DataSource methods** (in `WorkoutRemoteDataSource`):

```kotlin
suspend fun insertWorkout(payload: WorkoutInsertDto): WorkoutDto =
    supabase.postgrest["workouts"].insert(payload) { select() }.decodeSingle<WorkoutDto>()

suspend fun updateWorkout(workoutId: String, payload: WorkoutUpdateDto) {
    supabase.postgrest["workouts"].update(payload) { filter { eq("id", workoutId) } }
}

suspend fun deleteWorkout(workoutId: String) {
    supabase.postgrest["workouts"].delete { filter { eq("id", workoutId) } }
}

suspend fun replaceWorkoutExercises(workoutId: String, payloads: List<WorkoutExerciseInsertDto>) {
    supabase.postgrest["workout_exercises"].delete { filter { eq("workout_id", workoutId) } }
    if (payloads.isNotEmpty()) supabase.postgrest["workout_exercises"].insert(payloads)
}
```
Also in `getAssignedWorkouts` add a fourth branch — own plans — and shadow forks at repository level:
```kotlin
val ownPlans = supabase.postgrest["workouts"]
    .select(columns = Columns.raw("*, workout_exercises(*)")) {
        filter { eq("owner_user_id", userId); eq("is_active", true) }
        order("day_of_week", Order.ASCENDING)
    }.decodeList<WorkoutDto>()
return (global + legacyUserSpecific + viaJoinTable + ownPlans).distinctBy { it.id }
```
And exclude user plans from `getAllWorkouts` catalog: add `filter { exact("owner_user_id", null) }`.

- [ ] **Step 4: Repository impl + use cases + DI**

`WorkoutRepositoryImpl`: implement the three new methods with `runCatching` mapping like the existing ones; apply `shadowForks(...)` to `getAssignedWorkouts` result. Use cases are thin wrappers matching the project's use-case style (single `operator fun invoke`). Register in `AppModule.kt` next to the other workout use cases.

- [ ] **Step 5: Compile + tests + commit**

`./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest -q` → PASS.
```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/ composeApp/src/commonMain/kotlin/com/coachfoska/app/data/ composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt composeApp/src/commonTest/kotlin/com/coachfoska/app/data/
git commit -m "feat(workouts): data layer for user-authored plans, forks and substitution records"
```

---

### Task 6: Plans list + plan detail rework (coach vs user, edit/delete, empty state)

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutPlanScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutDetailScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/WorkoutViewModel.kt` (+ `WorkoutIntent.kt`, `WorkoutState.kt`)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt`, `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`

**Interfaces:**
- Consumes: `Workout.source/ownerUserId` (Task 5), `DeleteUserWorkoutUseCase`, `EmptyState`, `SectionHeader`, `FoskaFilterChip`, `Spacing`.
- Produces: route `@Serializable data class WorkoutEditor(val workoutId: String? = null)` in `Routes.kt` (screen built in Task 7 — this task adds the route + nav wiring with a placeholder composable that Task 7 replaces); `WorkoutIntent.DeleteWorkout(val workoutId: String)`.

- [ ] **Step 1: New strings** (add to `values/strings.xml`): `plan_title` "Plan", `plan_coach_badge` "Coach", `plan_mine_badge` "Mine", `plan_exercise_count` "%1$d exercises", `plan_last_performed` "Last: %1$s", `plan_never_performed` "Not performed yet", `plan_create_first_title` "Create your first workout", `plan_create_first_message` "No plan assigned yet. Build your own in a minute.", `plan_create_action` "Create workout", `plan_delete_confirm` "Delete this workout?", `common_edit` "Edit", `common_delete` "Delete", `common_cancel` "Cancel", `detail_start_workout` "Start workout", `detail_coach_readonly` "Coach plan — start it or substitute an exercise for your own copy.".

- [ ] **Step 2: WorkoutViewModel — delete intent + last-performed map**

Add `WorkoutIntent.DeleteWorkout(val workoutId: String)` handled by `DeleteUserWorkoutUseCase` then reload; add to `WorkoutState`: `val lastPerformedByWorkoutId: Map<String, Instant> = emptyMap()` computed from `workoutHistory` (`groupBy { it.workoutId }` → max `loggedAt`). Ensure the plans screen triggers `LoadHistory` too.

- [ ] **Step 3: Rework `WorkoutPlanScreen`**

Two sections via `SectionHeader`: coach plans (`source == COACH`) and "My workouts" (`source == USER`). Card additions to the existing `WorkoutPlanCard`: source badge chip (Coach/Mine), `plan_exercise_count`, duration, last-performed line (format date with existing `DateTimeUtils`), and for user plans a trailing overflow (`DropdownMenu`) with Edit → `onEditWorkout(workout.id)` and Delete → confirm `AlertDialog` → `WorkoutIntent.DeleteWorkout`. Top bar gains a `+` action (`onCreateWorkout`). Empty state (both lists empty):
```kotlin
EmptyState(
    icon = Icons.Default.FitnessCenter,
    title = stringResource(Res.string.plan_create_first_title),
    message = stringResource(Res.string.plan_create_first_message),
    actionLabel = stringResource(Res.string.plan_create_action),
    onAction = onCreateWorkout,
)
```
Replace the screen's remaining hardcoded strings with resources; replace ad-hoc paddings with `Spacing`.

- [ ] **Step 4: Plan detail (`WorkoutDetailScreen`)** — read the file first. Ensure: primary "Start workout" `CoachButton` (exists as Start; rename label to resource), coach plans show `detail_coach_readonly` note + Coach badge; user-owned plans (`workout.ownerUserId == currentUserId` — pass userId into the route composable, it's available in `App.kt`) show an Edit action navigating to `WorkoutEditor(workoutId)`. Keep exercise rows; add per-row substitute affordance ONLY as UI stub calling `onSubstitute(exerciseIndex)` — Task 8 implements the sheet (leave the callback unused/no-op with a `// wired in substitution task` note if Task 8 runs later).

- [ ] **Step 5: Route + nav wiring** — add `WorkoutEditor` to `Routes.kt`; in `App.kt` add `composable<WorkoutEditor> { /* Task 7 screen */ }` and navigation calls from plans list (`+`/Edit). Until Task 7 lands, point it at a `Box {}` placeholder so this task compiles independently.

- [ ] **Step 6: Compile + commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt composeApp/src/commonMain/composeResources/values/strings.xml
git commit -m "feat(workouts): plans list/detail with coach-vs-mine, edit/delete own plans, guided empty state"
```

---

### Task 7: Create/Edit Workout screen (user-authored)

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/WorkoutEditorViewModel.kt` (state+intent+VM in one file, mirroring `ActiveSession*` file style is fine too — pick one, keep it together)
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutEditorScreen.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExercisePickerSheet.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`, `App.kt` (replace Task 6 placeholder)
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Test: `composeApp/src/commonTest/kotlin/com/coachfoska/app/presentation/workout/WorkoutEditorViewModelTest.kt`

**Interfaces:**
- Consumes: `SaveUserWorkoutUseCase`-style use cases from Task 5 (`createUserWorkout`/`updateUserWorkout` via repository), `GetWorkoutByIdUseCase`, `ExerciseRepository.searchExercises(query)` + `getExercises(...)` (existing), `EmptyState`, `FoskaFilterChip`, `Spacing`, `CoachTextField`, `CoachButton`.
- Produces: `WorkoutEditorViewModel(getWorkoutById, workoutRepository, userId)` with:

```kotlin
data class EditorExercise(
    val exerciseId: String?, val name: String, val muscleGroup: String?,
    val sets: Int = 3, val reps: String = "10", val restSeconds: Int = 90,
    val substitutedFromExerciseId: String? = null, val substitutedFromName: String? = null,
)
data class WorkoutEditorState(
    val workoutId: String? = null,          // null = create
    val name: String = "",
    val dayOfWeek: DayOfWeek? = null,
    val exercises: List<EditorExercise> = emptyList(),
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val savedWorkoutId: String? = null,     // non-null → navigate back
    val nameError: Boolean = false,
    val exercisesError: Boolean = false,
    val error: String? = null,
)
sealed interface WorkoutEditorIntent {
    data class Load(val workoutId: String?) : WorkoutEditorIntent
    data class UpdateName(val value: String) : WorkoutEditorIntent
    data class UpdateDay(val day: DayOfWeek?) : WorkoutEditorIntent
    data class AddExercise(val exercise: Exercise) : WorkoutEditorIntent
    data class RemoveExercise(val index: Int) : WorkoutEditorIntent
    data class MoveExercise(val index: Int, val delta: Int) : WorkoutEditorIntent
    data class UpdateSets(val index: Int, val sets: Int) : WorkoutEditorIntent
    data class UpdateReps(val index: Int, val reps: String) : WorkoutEditorIntent
    data class UpdateRest(val index: Int, val seconds: Int) : WorkoutEditorIntent
    data object Save : WorkoutEditorIntent
    data object DismissError : WorkoutEditorIntent
}
```

- [ ] **Step 1: Write failing VM tests** (`WorkoutEditorViewModelTest.kt`, fake `WorkoutRepository`):
  - `save_requires_name_and_one_exercise` — empty name + empty list → `Save` sets `nameError=true`, `exercisesError=true`, repository never called.
  - `save_create_calls_createUserWorkout_and_sets_savedWorkoutId`.
  - `load_existing_populates_fields` — fake returns a `Workout` with 2 exercises → state mirrors it.
  - `move_exercise_reorders` — `[A,B,C]` + `MoveExercise(2, -1)` → `[A,C,B]`.
Run → FAIL.

- [ ] **Step 2: Implement VM**

`AddExercise` maps `Exercise` → `EditorExercise(exerciseId = e.id, name = e.name, muscleGroup = e.muscles.firstOrNull() ?: e.category?.name)`. `Save`: validate (name non-blank, ≥1 exercise → inline error flags, no dialogs); build `WorkoutDraft` (`WorkoutExerciseDraft` per row, sortOrder = index); `workoutId == null` → `createUserWorkout(userId, draft)` else `updateUserWorkout(workoutId, draft)`; on success `savedWorkoutId = result.id`. Register in DI: `viewModel { (userId: String) -> WorkoutEditorViewModel(get(), get(), userId) }`.

- [ ] **Step 3: Run tests** → PASS.

- [ ] **Step 4: Editor UI**

`WorkoutEditorScreen.kt` — structure (all labels from resources; keys: `editor_title_new` "New workout", `editor_title_edit` "Edit workout", `editor_name_label` "Workout name", `editor_name_error` "Give it a name", `editor_exercises_error` "Add at least one exercise", `editor_add_exercise` "Add exercise", `editor_day_label` "Day (optional)", `editor_sets` "Sets", `editor_reps` "Reps", `editor_rest` "Rest (s)", `editor_save` "Save workout"):
- `CoachTopBar` with title + back.
- `CoachTextField` for name (`isError = state.nameError`, supporting text on error).
- Day-of-week selector: `LazyRow` of 7 `FoskaFilterChip`s (Mon-first; tap again to clear).
- Exercise list: one card per `EditorExercise` — name + muscle group, steppers/inputs for sets (numeric), reps (text, e.g. "8-12"), rest seconds (numeric); up/down `IconButton`s (`Icons.Default.KeyboardArrowUp/Down`, 48dp) for reorder; remove (trash) button.
- "Add exercise" button opens `ExercisePickerSheet`.
- Bottom: `CoachButton(editor_save)` → `Save`; on `state.savedWorkoutId != null` → `LaunchedEffect` navigate back.
- If `state.exercisesError` → inline error text under the list, `TextAccent` color.

`ExercisePickerSheet.kt` — `ModalBottomSheet` with a search `CoachTextField`; results via `ExerciseRepository.searchExercises(query)` debounced 300ms (do it in the sheet's own small `ViewModel` or hoist into `WorkoutEditorViewModel` with `SearchExercises(query)` intent — prefer the intent to avoid a second VM); rows show name + muscle + thumbnail (Coil `AsyncImage`, existing pattern in `ExerciseLibraryScreen.kt` — copy its image loading approach); tap → `AddExercise` + keep sheet open (multi-add), explicit Done button closes.

- [ ] **Step 5: Wire route** — replace Task 6's placeholder in `App.kt`:
```kotlin
composable<WorkoutEditor> { backStackEntry ->
    val route = backStackEntry.toRoute<WorkoutEditor>()
    WorkoutEditorRoute(
        userId = currentUserId,               // same pattern the neighbouring composables use
        workoutId = route.workoutId,
        onDone = { navController.popBackStack() },
    )
}
```

- [ ] **Step 6: Compile + tests + commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/WorkoutEditorViewModel.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutEditorScreen.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExercisePickerSheet.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt composeApp/src/commonMain/composeResources/values/strings.xml composeApp/src/commonTest/kotlin/com/coachfoska/app/presentation/workout/WorkoutEditorViewModelTest.kt
git commit -m "feat(workouts): create/edit user workout with exercise library picker"
```

---

### Task 8: Exercise substitution (session-scope + plan-forward fork)

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/SubstituteExerciseSheet.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionViewModel.kt` (+ Intent/State/SessionDraft)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActiveSessionScreen.kt`, `WorkoutDetailScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` (inject `ForkWorkoutUseCase`/repository + `ExerciseRepository` where needed)
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Test: extend `composeApp/src/commonTest/.../ActiveSessionViewModelTest*` (find existing; create if none)

**Interfaces:**
- Consumes: `ExerciseRepository.searchExercises/getExercisesByCategory`, `Workout.source`, `createUserWorkout(forkedFromWorkoutId=...)` (Task 5), `FoskaFilterChip`, `EmptyState`.
- Produces: `ActiveSessionIntent.SubstituteExercise(val exerciseIndex: Int, val replacement: Exercise)`; `SessionDraft` exercise entries gain `exerciseId: String?`, `substitutedFromExerciseId: String?`, `substitutedFromName: String?` (read `SessionDraft.kt` first — it has an `exercises: List<ExerciseDraft>`-style structure; add fields there).

- [ ] **Step 1: Strings**: `substitute_title` "Substitute exercise", `substitute_cant_do` "Can't do this one", `substitute_suggested` "Same muscle group", `substitute_search_hint` "Search exercises", `substitute_scope_session` "Just this session", `substitute_scope_plan` "For this plan going forward", `substitute_applied` "Swapped %1$s → %2$s".

- [ ] **Step 2: Failing VM test** — `substitute_swaps_draft_exercise_and_records_origin`: build a draft with exercise "Bench Press" (id b1), send `SubstituteExercise(0, exercise(id="d1", name="Dumbbell Press"))`, assert draft`[0].exerciseName == "Dumbbell Press"`, `substitutedFromName == "Bench Press"`, `substitutedFromExerciseId == "b1"`, sets preserved (targets kept, completed sets untouched). Run → FAIL.

- [ ] **Step 3: Implement session-scope substitution in `ActiveSessionViewModel`**

`SubstituteExercise` updates the draft entry in place: swap `exerciseName`/`exerciseId`/`videoUrl` (from the replacement `Exercise`), set `substitutedFrom*` from the OLD values (only if not already substituted — first origin wins), keep set structure. Clear that exercise's prefill (`previousData` keyed by old name stays; reload prefill for the new name via `getPreviousLogsUseCase(userId, listOf(replacement.name))` merged into `previousData`). Test → PASS.

- [ ] **Step 4: `SubstituteExerciseSheet` UI**

`ModalBottomSheet`: header `substitute_title`; section `substitute_suggested` — list from `ExerciseRepository.getExercisesByCategory(currentExercise.category)` when resolvable (resolve by looking up the current exercise: if draft has `exerciseId`, `getExerciseById` → its `category.id`; else skip suggestions); below, search field + results (same pattern as Task 7's picker — extract a shared `ExerciseSearchList` composable into `ui/workout/components/` and reuse in both sheets). Tap result →
  - In Active Session: apply immediately (`SubstituteExercise`), show snackbar `substitute_applied`, close.
  - In Plan Detail: show a two-option choice (`AlertDialog` with two buttons or a second sheet step): `substitute_scope_session` → navigate to `ActiveSession` carrying the swap? NO — too much coupling. Session-scope from Plan Detail = start session then substitute there; so in Plan Detail offer ONLY `substitute_scope_plan` when the plan is a coach plan or user plan:
    - user plan → `updateUserWorkout` with the swapped exercise (records `substituted_from_*`),
    - coach plan → `createUserWorkout(userId, draftFromWorkout(workout, swap), forkedFromWorkoutId = workout.id)` → reload plans (fork now shadows the original per Task 5).
  Flag in the final report: "session-scope substitution entry lives in the Active Workout; Plan Detail offers plan-forward only" (allowed simplification — spec §3.2.5 permits cutting scope complexity, we keep BOTH scopes but each at its natural entry point).

- [ ] **Step 5: Entry points**

Active session: per-exercise overflow/button `substitute_cant_do` opens the sheet for the current exercise. Plan detail: per-exercise-row swap icon (48dp target) opens the sheet.

- [ ] **Step 6: Compile + tests + commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ composeApp/src/commonMain/composeResources/values/strings.xml composeApp/src/commonTest/kotlin/com/coachfoska/app/
git commit -m "feat(workouts): exercise substitution — session scope + plan-forward fork"
```
(Yes, this stages broad dirs — every file inside is plan work from this task; verify `git status` shows nothing unrelated before committing.)

---

### Task 9: Active session — per-set autosave, resume, signature micro-interaction

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/SessionDraft.kt`, `ActiveSessionState.kt`, `ActiveSessionIntent.kt`, `ActiveSessionViewModel.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/WorkoutDto.kt`, `datasource/WorkoutRemoteDataSource.kt`, `domain/repository/WorkoutRepository.kt`, `data/repository/WorkoutRepositoryImpl.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActiveSessionScreen.kt`, `SetInputRow.kt`, `ActivityHubScreen.kt`
- Modify: `Routes.kt` (`ActiveSession` gains `resumeLogId: String? = null`), `App.kt`
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Test: `composeApp/src/commonTest/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionAutosaveTest.kt`

**Interfaces:**
- Produces repository methods:
```kotlin
suspend fun startWorkoutSession(userId: String, workoutId: String?, workoutName: String): Result<String> // returns workout_log id (status='in_progress')
suspend fun saveSetLog(workoutLogId: String, exerciseName: String, exerciseId: String?,
    substitutedFromExerciseId: String?, substitutedFromName: String?,
    existingExerciseLogId: String?, set: SetLog): Result<SavedSetRef>  // data class SavedSetRef(val exerciseLogId: String, val setLogId: String)
suspend fun updateSetLog(setLogId: String, set: SetLog): Result<Unit>
suspend fun finishWorkoutSession(workoutLogId: String, durationMinutes: Int, notes: String?): Result<Unit>   // status='completed'
suspend fun discardWorkoutSession(workoutLogId: String): Result<Unit>                                        // status='discarded'
suspend fun getInProgressSession(userId: String): Result<WorkoutLog?>   // newest in_progress with exercise_logs+set_logs
```
- DTO: `WorkoutLogInsertDto` gains `val status: String = "completed"`; `WorkoutLogDto` gains `val status: String = "completed"`; new `WorkoutLogUpdateDto(@SerialName("duration_minutes") durationMinutes: Int? = null, notes: String? = null, status: String? = null)`; `SetLogInsertDto` unchanged; `ExerciseLogInsertDto` gains `@SerialName("exercise_id") exerciseId: String? = null`, `@SerialName("substituted_from_exercise_id")`, `@SerialName("substituted_from_name")`.
- History/streak queries (`getWorkoutLogs`, `getWorkoutLogsSince`) now filter `eq("status", "completed")`.
- `SessionDraft`: add `workoutLogId: String? = null`; per exercise `exerciseLogId: String? = null`; per set `setLogId: String? = null`, `saveState: SetSaveState = SetSaveState.Idle` (`enum class SetSaveState { Idle, Saving, Saved, Failed }`).
- Intents: `RetrySetSave(val exerciseIndex: Int, val setIndex: Int)`, `DiscardSession`, plus `InitSession(workoutId, resumeLogId)`.

- [ ] **Step 1: Failing tests** (`ActiveSessionAutosaveTest.kt`, fake repository recording calls):
  - `marking_set_complete_autosaves_it` — MarkSetComplete(completed=true) → fake `saveSetLog` called once with actual reps/weight; draft set gets `setLogId`, `saveState == Saved`.
  - `autosave_failure_marks_failed_and_retry_saves` — fake fails once → `saveState == Failed`; `RetrySetSave` → succeeds → `Saved`. Values never lost from the draft.
  - `unmarking_completed_set_updates_row` — after save, MarkSetComplete(completed=false) → `updateSetLog` called with `completed=false`.
  - `finish_updates_status_completed` — SubmitSession → `finishWorkoutSession(workoutLogId, ...)` (NOT the old `logWorkout` bulk path when a live session id exists).
  - `init_with_resumeLogId_rebuilds_completed_sets` — fake `getInProgressSession` returns a log with 1 exercise/2 completed sets → draft marks them completed with ids, `sessionStartTime` from `loggedAt`.
Run → FAIL.

- [ ] **Step 2: Data layer**

Datasource:
```kotlin
suspend fun insertInProgressWorkoutLog(userId: String, workoutId: String?, workoutName: String): WorkoutLogDto =
    supabase.postgrest["workout_logs"].insert(
        WorkoutLogInsertDto(userId = userId, workoutName = workoutName, durationMinutes = 0,
            loggedAt = currentInstant().toString(), workoutId = workoutId, status = "in_progress")
    ) { select() }.decodeSingle<WorkoutLogDto>()

suspend fun updateWorkoutLog(id: String, payload: WorkoutLogUpdateDto) {
    supabase.postgrest["workout_logs"].update(payload) { filter { eq("id", id) } }
}

suspend fun updateSetLog(id: String, payload: SetLogInsertDto) {
    supabase.postgrest["set_logs"].update(payload) { filter { eq("id", id) } }
}

suspend fun getInProgressWorkoutLog(userId: String): WorkoutLogDto? =
    supabase.postgrest["workout_logs"]
        .select(columns = Columns.raw("*, exercise_logs(*, set_logs(*))")) {
            filter { eq("user_id", userId); eq("status", "in_progress") }
            order("logged_at", Order.DESCENDING)
            limit(1)
        }.decodeList<WorkoutLogDto>().firstOrNull()
```
Add `eq("status", "completed")` to `getWorkoutLogs` and `getWorkoutLogsSince` filters. Repository: implement the six interface methods above; `saveSetLog` creates the exercise_log lazily (when `existingExerciseLogId == null`, insert `ExerciseLogInsertDto` including substitution fields, then insert the set) and returns both ids.

- [ ] **Step 3: ViewModel**

- `initSession`: after loading the workout and building the draft, call `startWorkoutSession` → store `workoutLogId` in draft. If it fails: keep session usable, set a `sessionSaveDegraded = true` flag in state (banner "Working offline of the log — finish will retry"), and let `submitSession` fall back to the existing bulk `logWorkoutUseCase` path (this is the retry-not-loss guarantee).
- `initSession(resumeLogId != null)`: `getInProgressSession` → rebuild draft: load workout by `log.workoutId` when present for targets; for each logged exercise map completed sets (with `setLogId`, `saveState=Saved`); exercises in the workout but not yet logged appear fresh; freestyle (null workoutId) → draft purely from log.
- `markSetComplete(completed=true)`: existing logic (timer/prefill/PR/advance) unchanged, plus launch autosave: set `saveState=Saving`; `setLogId == null` → `saveSetLog` (store returned ids in draft) else `updateSetLog`; failure → `Failed` (with Napier log). `completed=false` on a saved set → `updateSetLog(completed=false)`.
- `RetrySetSave` re-runs the same save.
- `submitSession`: when `workoutLogId != null` → `finishWorkoutSession(workoutLogId, durationMinutes, notes)`; sets already live server-side; then `submittedLogId = workoutLogId`. When null (degraded) → old bulk path.
- `DiscardSession` → `discardWorkoutSession` then a `sessionDiscarded = true` state → UI navigates back.

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: UI — save indicator, resume banner, discard, micro-interaction**

Strings: `session_saved` "Saved", `session_saving` "Saving…", `session_save_failed` "Not saved — tap to retry", `session_resume_title` "Workout in progress", `session_resume_action` "Resume", `session_discard` "Discard workout", `session_discard_confirm` "Discard this session? Logged sets will be removed from history.", `session_volume` "Volume".
- `SetInputRow.kt`: read the file; next to the done checkbox render the per-set save state — tiny `Saved` check (Success color) / `Saving…` progress (12dp) / `Failed` → clickable `session_save_failed` label in `TextAccent` firing `RetrySetSave`. **Micro-interaction (spec §2.4 signature):** on transition to completed animate the row's done control with a spring scale (1f → 1.15f → 1f, `spring(dampingRatio = Spring.DampingRatioMediumBouncy)`) and fire `LocalHapticFeedback.current.performHapticFeedback(HapticFeedbackType.LongPress)`; under `LocalReduceMotion.current` skip the scale (keep the haptic).
- `ActiveSessionScreen.kt`: header adds running session volume (`Σ completed actualReps × actualWeightKg`, formatted kg) rendered with `MetricSmall` and animated count-up via `animateIntAsState` (skip under reduce-motion) — numbers in motion on every set. Add `session_discard` to the screen's overflow/menu with confirm dialog.
- `ActivityHubScreen.kt`: on load also fetch `getInProgressSession` (via `WorkoutViewModel` — add `WorkoutState.inProgressSession: WorkoutLog?` + load in `LoadWorkouts`); when non-null show a banner card at top: `session_resume_title`, workout name, elapsed-since text, `session_resume_action` button → `onResumeSession(log.workoutId ?: "", log.id)` → navigate `ActiveSession(workoutId, resumeLogId = log.id)`.
- `Routes.kt`: `@Serializable data class ActiveSession(val workoutId: String, val resumeLogId: String? = null)`; update `App.kt` composable + all `navigate(ActiveSession(...))` call sites.

- [ ] **Step 6: Compile + full unit tests + commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ composeApp/src/commonMain/composeResources/values/strings.xml composeApp/src/commonTest/kotlin/com/coachfoska/app/
git commit -m "feat(session): per-set autosave with retry, resumable sessions, set-completion signature interaction"
```

---

### Task 10: Recipes polish (app) + featured toggle (admin)

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/RecipesListScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/recipe/RecipeDetailScreen.kt`
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Modify: `admin/src/pages/admin/Nutrition.tsx`
- Modify (if `featured` missing on the type): `admin/src/types/database.ts`

**Interfaces:**
- Consumes: `EmptyState`, `FoskaFilterChip`, `ShimmerBox`, `Spacing`; `Recipe.tags: List<String>` (exists), `recipes.featured` column (exists).

- [ ] **Step 1: App — tag filter + empty state + i18n**

`RecipesListScreen.kt`: add a `LazyRow` of tag chips above the list — tags = `state.recipes.flatMap { it.tags }.distinct().sorted()`, selected tag filters the list (single-select; tap again clears; combines with the existing favorites filter). Hide the row when no recipe has tags. Replace hardcoded "Favorites" and any other literals with resources (`recipes_favorites_filter` "Favorites", `recipes_empty_title` "No recipes yet", `recipes_empty_message` "Your coach is cooking something up. Check back soon."). Empty list → `EmptyState(icon = Icons.Default.Restaurant, ...)` — this WILL show in production until the coach adds real recipes (sample recipes get deleted), so make it look intentional. Loading → 3 shimmer card placeholders using `ShimmerBox`. Move the detail screen's "Ingredients"/"Directions" tab labels and empty texts to resources (`recipe_tab_ingredients`, `recipe_tab_directions`, `recipe_no_ingredients`, `recipe_no_steps`).

- [ ] **Step 2: Compile app** — `./gradlew :composeApp:compileDebugKotlinAndroid -q` → OK.

- [ ] **Step 3: Admin — featured star toggle in RecipesTab**

In `admin/src/types/database.ts` ensure `Recipe` has `featured: boolean` (add if missing). In `Nutrition.tsx` `RecipesTab`, add a mutation + a star cell in the recipes table row (before the Edit/Delete buttons):
```tsx
const toggleFeatured = useMutation({
  mutationFn: async (r: Recipe) => {
    const { error } = await supabase.from('recipes').update({ featured: !r.featured }).eq('id', r.id)
    if (error) throw error
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes-admin'] }),
})
```
```tsx
<Td>
  <button
    onClick={() => toggleFeatured.mutate(r)}
    title={r.featured ? 'Remove from featured' : 'Feature on the app home'}
    className={`text-sm bg-transparent border-0 cursor-pointer ${r.featured ? 'text-amber-400' : 'text-[var(--text-disabled)] hover:text-[var(--text-muted)]'}`}
  >★</button>
</Td>
```
Add a `<Th>Featured</Th>` to the header row in the matching position. Follow the existing table cell patterns in the file exactly.

- [ ] **Step 4: Admin tests + build**

Run: `cd admin && npm run test` → existing vitest suite PASSES; `npm run build` → tsc + vite OK.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/RecipesListScreen.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/recipe/RecipeDetailScreen.kt composeApp/src/commonMain/composeResources/values/strings.xml admin/src/pages/admin/Nutrition.tsx admin/src/types/database.ts
git commit -m "feat(recipes): tag filter + designed empty state in app; featured toggle in admin"
```

---

### Task 11: Me tab — profile header stat, progress empty state, chart tokens

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/ProfileScreen.kt`, `ProgressScreen.kt`, `SettingsScreen.kt` (visual pass only)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ProgressDashboardScreen.kt` (chart color roles)
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`

**Interfaces:**
- Consumes: `MetricCard`, `StatRow`, `EmptyState`, `SectionHeader`, `ChartLine/ChartFill/ChartGrid`, `Spacing`; `LogWeightUseCase` (exists) via the existing profile ViewModel (read `presentation/profile/` first for exact intents/state).

- [ ] **Step 1: Read `presentation/profile/` ViewModel/state files** to learn the existing weight-entry intent (there is `LogWeightUseCase`; find its intent — if the UI has no add-weight entry point, add a minimal dialog: number field + save via that use case).

- [ ] **Step 2: ProfileScreen** — top-line stat treatment (spec §6.1): header shows avatar+name (exists) plus a `Row` of two `MetricCard`s: current weight, workouts this month (compute from `WorkoutRepository.getWorkoutCountByWeek` or history via existing profile state if it has it — else pass through the profile VM by injecting `GetWorkoutHistoryUseCase`; keep it simple: count of history logs with `loggedAt` in the current month). Replace ad-hoc stat boxes (`ProfileStatCard`) with `MetricCard`. Menu rows stay.

- [ ] **Step 3: ProgressScreen** — when `weightHistory.isEmpty()` → `EmptyState(icon = Icons.AutoMirrored.Filled.TrendingUp, title = progress_empty_title "Track your first weight", message = progress_empty_message "Log your weight to see your trend here.", actionLabel = progress_empty_action "Add weight", onAction = { showAddWeightDialog = true })`. Recolor `WeightChart` to `ChartLine`/`ChartFill`/`ChartGrid` (one chart recipe app-wide). In `ProgressDashboardScreen.kt`, apply the same chart roles to its charts.

- [ ] **Step 4: SettingsScreen** — visual pass only: swap ad-hoc paddings for `Spacing`, ensure rows ≥48dp. Do not change behavior.

- [ ] **Step 5: Compile + commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/ composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ProgressDashboardScreen.kt composeApp/src/commonMain/composeResources/values/strings.xml composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/profile/
git commit -m "feat(me): metric header, progress empty state with first-weight action, unified chart tokens"
```

---

### Task 12: ActivityHub + remaining hardcoded strings to resources

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt` (worst offender: "YOUR WORKOUTS", "ALL WORKOUTS", "EXERCISES", "SEE ALL", "START WORKOUT", "BROWSE WORKOUTS", "WORKOUT HISTORY", "PROGRESS ANALYTICS", "LOG ACTIVITY", "No workouts assigned yet.")
- Modify: every other file found by the audit greps below
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`

- [ ] **Step 1: Find every offender**

```bash
grep -rn 'Text("' composeApp/src/commonMain/kotlin --include="*.kt" | grep -v 'Text("")' | grep -v Preview
grep -rn 'text = "' composeApp/src/commonMain/kotlin --include="*.kt" | grep -v Preview
grep -rn 'contentDescription = "' composeApp/src/commonMain/kotlin --include="*.kt" | grep -v 'contentDescription = null'
```
Preview-only strings and log tags are exempt. Everything user-visible gets a key.

- [ ] **Step 2: Extract each to `values/strings.xml`** with a screen-prefixed key (`activity_hub_your_workouts`, etc.), replace with `stringResource(Res.string.<key>)`. In `ActivityHubScreen` also swap its private `SectionHeader` for the shared `SectionHeader` (Task 3) with `actionLabel = stringResource(Res.string.common_see_all)`.

- [ ] **Step 3: Compile** — `./gradlew :composeApp:compileDebugKotlinAndroid -q` → OK. Re-run Step 1 greps → zero user-visible hits.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ composeApp/src/commonMain/composeResources/values/strings.xml
git commit -m "refactor(i18n): move all remaining user-visible strings to resources"
```

---

### Task 13: Czech-default localization

**Files:**
- Create: `composeApp/src/commonMain/composeResources/values-en/strings.xml` (current English content moves here)
- Rewrite: `composeApp/src/commonMain/composeResources/values/strings.xml` (Czech, same keys)

The spec (§7): Czech default, structured for Slovak later. Compose resources use Android-style qualifiers: `values/` = default/fallback, `values-en/` = English. A Czech phone shows Czech; an English phone shows English.

- [ ] **Step 1: Copy** `values/strings.xml` → `values-en/strings.xml` verbatim.

- [ ] **Step 2: Translate every string in `values/strings.xml` to Czech.** Rules: informal "ty" form (fitness-coach voice, e.g. "Zaloguj první trénink" not "Zalogujte"); keep placeholders (`%1$s`, `%1$d`) intact and in grammatical position; keep uppercase style where the EN string is uppercase (Czech diacritics uppercase fine: "ZAČÍT TRÉNINK"); fitness terms Czech gym-goers actually use (trénink, série, opakování, zátěž, jídelníček, recepty, oblíbené). Do NOT translate the brand "FOSKA".

- [ ] **Step 3: Verify key parity**

```bash
diff <(grep -o 'name="[^"]*"' composeApp/src/commonMain/composeResources/values/strings.xml | sort) \
     <(grep -o 'name="[^"]*"' composeApp/src/commonMain/composeResources/values-en/strings.xml | sort)
```
Expected: no output (identical key sets).

- [ ] **Step 4: Compile** (resource codegen catches malformed XML): `./gradlew :composeApp:compileDebugKotlinAndroid -q` → OK.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/composeResources/
git commit -m "feat(i18n): Czech as default locale, English in values-en"
```

---

### Task 14: Onboarding visual alignment (logic untouched)

**Files:**
- Modify: files under `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/` — visual properties ONLY

- [ ] **Step 1: List the screens** (`ls ui/onboarding/`), read each briefly. Allowed changes: replace ad-hoc `dp` paddings with `Spacing`, ad-hoc buttons with `CoachButton`, ad-hoc text styles with theme typography, one-off grays with theme colors. FORBIDDEN: any change to state, callbacks, navigation, validation, step order (spec §1: "do not touch its logic").

- [ ] **Step 2: Compile.** If any change would alter behavior, skip it and note it.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/
git commit -m "style(onboarding): align to design tokens, logic untouched"
```

---

### Task 15: Accessibility + polish pass (Chanel rule)

**Files:**
- Modify: touched screens as found

- [ ] **Step 1: Touch-target sweep**

```bash
grep -rn "IconButton" composeApp/src/commonMain/kotlin/com/coachfoska/app/ui --include="*.kt" -A2 | grep -n "size(3[0-9]\|size(4[0-7]"
```
Any interactive element sized <48dp gets `Modifier.size(Sizes.touchTarget)` (icon inside can stay smaller). Known offender fixed in Task 4 (water quick-add 40dp); re-verify none remain.

- [ ] **Step 2: Contrast check (manual reasoning, document in commit message)** — red text usages: anything rendering `BrandRed`/`Error` as small text on `background`/`surface` should use `TextAccent` (BrandRedLight) or become an icon+neutral-text pair. `Gray500`-on-black body text (4.6:1) passes; `Gray600` (2.9:1) must not be used for body text — grep `Gray600` usages in dark contexts and bump to `Gray400/Gray500`.

- [ ] **Step 3: Screenshot review** — build + install on the running emulator/device (`./gradlew :composeApp:installDebug`), walk Home → Activity → Plans → Detail → Active session (log 2 sets) → Recipes → Detail → Me → Progress → Settings, screenshot each (use the mobile MCP or `adb exec-out screencap`). For each screen remove ONE decoration that isn't earning its place (spec §2.5 Chanel rule) — typical candidates: duplicate dividers, double borders, redundant labels. Keep a list of what was removed.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/
git commit -m "polish(a11y): 48dp targets, AA-safe text colors, one-decoration-per-screen cut"
```

---

### Task 16: End-to-end verification (app + admin)

**Files:** none (verification only) — REQUIRED SUB-SKILL: superpowers:verification-before-completion

- [ ] **Step 1: Full builds + tests**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest -q
cd admin && npm run test && npm run build
```
Expected: all green. iOS spot-check if a Mac toolchain target is quick: `./gradlew :composeApp:compileKotlinIosSimulatorArm64 -q`.

- [ ] **Step 2: E2E flow — coach side (admin)**

`cd admin && npm run dev`, log in as the admin user. Verify: create a workout plan with 3 exercises from the library → assign it to a test user; mark a recipe featured; open Users → the test user → see profile/weight/log data.

- [ ] **Step 3: E2E flow — user side (app on emulator/device)**

As the test user: Home shows metrics row + today/assigned workout → start the assigned (coach) workout → substitute one exercise ("can't do this one") → complete 2 sets (watch autosave "Saved" ticks + the completion animation + volume count-up) → kill the app mid-session → relaunch → Resume banner appears → resume → finish → summary shows → Home week count incremented. Then: create own workout (name + 2 exercises) → it appears under "My workouts" with Mine badge → edit it → delete it. Recipes: featured recipe visible on Nutrition hub; tag filter + favorite work. Me: weight chart renders with brand chart colors; Settings opens.

- [ ] **Step 4: Data check** — in Supabase (MCP `execute_sql`): the substituted exercise_log row has `substituted_from_name` set; the finished workout_log has `status='completed'`; no stray `in_progress` rows for the test user.

- [ ] **Step 5: Report** — summarize what shipped, flagged cuts (Plan-Detail session-scope substitution entry, any onboarding styling skips), and anything found broken during E2E as follow-ups.

---

## Self-review notes (spec coverage)

- §2 tokens/components → Tasks 2, 3. §2.4 signature interaction → Task 9 (set completion) + MetricCard count-up (Task 3). §2.5 order → task order matches; Chanel rule → Task 15.
- §3.1 model → Tasks 1, 5 (fork-on-modify instead of fork-on-start: a coach plan is forked only when the user actually changes it — starting/performing never mutates plans, so no instance is needed for a plain run; logs already capture performance. This satisfies "never mutate coach content" with fewer rows; flagged for owner review).
- §3.2.1 → Task 6; §3.2.2 → Task 6; §3.2.3 → Task 9 (autosave, resume, states, micro-interaction; prefill/rest-timer/PR already existed); §3.2.4 → Task 7; §3.2.5 → Task 8 (both scopes; session-scope entry lives in Active Workout).
- §4 recipes → mostly pre-existing; deltas in Task 10 (tags filter, empty states, admin featured). Scaling/favorites/steps verified already wired.
- §5 dashboard → Task 4. §6 Me → Task 11. §7 cross-cutting → Tasks 12, 13 (i18n), 15 (a11y), autosave-retry (Task 9), Monday weeks (Task 4). §8 order → followed. §9 guardrails → in Global Constraints.
- Admin E2E → Tasks 10 (featured), 16 (verification). Admin workout authoring/assignment already works — no changes needed there.
