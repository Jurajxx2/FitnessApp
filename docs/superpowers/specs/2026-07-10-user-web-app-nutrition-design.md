# Coach Foska — User Web App (Nutrition MVP) — Design

**Date:** 2026-07-10
**Status:** Approved (design), pending implementation plan
**Author:** Juraj + Claude

## 1. Goal & rationale

Deliver a **user-facing web app** for Coach Foska's clients as the fastest, lowest-risk
path to an MVP. The mobile app is Kotlin Multiplatform + Compose, but Compose-for-Web
(Wasm/canvas) carries real UX/maturity tradeoffs (SEO, a11y, bundle size). We already
have a **working React + Vite + Tailwind + supabase-js admin** (`admin/`) whose stack,
auth, deployment, and data patterns we can clone. Therefore the user web app is built on
the **same web stack as the admin**, *restyled* to match the mobile app's look.

**Primary objective chosen:** fastest MVP to users.
**First slice:** the **Nutrition** section only, with **view + log meals**.
**Auth:** **email OTP only**.
**Design-system scope:** **new user app only** — do not touch the existing admin styling.

Key property: **no backend changes.** Every Nutrition query is direct PostgREST against
existing tables, already RLS-scoped to the signed-in user. The web app authenticates as
the same Supabase user (anon key + user JWT), so the same policies apply automatically.

## 2. Tech stack (mirror `admin/`)

- React 19, Vite 6, TypeScript ~5.8
- Tailwind CSS 4 (`@tailwindcss/vite`)
- `@supabase/supabase-js` ^2
- `@tanstack/react-query` ^5
- `react-router-dom` ^7
- `framer-motion` ^12 (route/tab transitions, ring animations)
- `lucide-react` (icons)
- Testing: Vitest + `@testing-library/react` + jsdom (clone `admin/src/test-setup.ts`)
- Deploy: Netlify, its own site + `netlify.toml` (clone admin's SPA redirect config)

## 3. Project layout

New sibling folder **`webapp/`** in the monorepo (parallel to `admin/`). Own
`package.json`, `vite.config.ts`, `tsconfig*.json`, `.env` (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`), `netlify.toml`, `index.html`. It is a fully independent Vite
app — it does not import from `admin/` at build time; instead we **copy-and-restyle**
these admin files as the starting scaffold:

- `src/lib/supabase.ts` (verbatim — same client config incl. localStorage persistence + `lock` shim)
- `src/lib/logger.ts`, `src/lib/loggingFetch.ts`, `src/lib/queryClient.ts` (verbatim)
- `src/hooks/useAuth.tsx` (**strip the `is_admin` gate** — every authenticated user is a valid user; keep session/profile resolution)
- `src/components/RouteGuard.tsx` (redirect unauthenticated → `/login`; remove the not-admin branch)
- `src/pages/Login.tsx`, `src/pages/Verify.tsx` (email OTP flow; restyle)
- `src/components/ui/*` primitives as a starting point, then re-skinned (§5)

```
webapp/
  index.html
  package.json  vite.config.ts  tsconfig*.json  netlify.toml  .env(.example)
  src/
    main.tsx  App.tsx  index.css
    design/            # token layer (§5)
      tokens.css       # CSS custom properties, light + dark
    lib/               # supabase, logger, queryClient (from admin)
    hooks/             # useAuth (de-admined), nutrition query hooks (§7)
    types/             # database.ts (copy the nutrition-relevant rows from admin)
    components/
      ui/              # restyled primitives (§5)
      AppShell.tsx     # TopBar + BottomNav layout
    pages/
      Login.tsx  Verify.tsx
      nutrition/       # Hub, Plan, Recipes, RecipeDetail, History, HistoryDetail, LogMeal
    test-setup.ts
```

## 4. Design system — web token layer (mirrors mobile `designsystem`)

Discipline (same as `DsColors`): components read **semantic tokens only**, never raw hex.

### 4.1 Color tokens (ported 1:1 from `FoskaBrand`)

Raw palette: `BrandRed #A90707`, `BrandRedLight #CF2E2E`, Black `#000000`, White `#FFFFFF`,
Gray100 `#F5F5F5`, Gray200 `#EEEEEE`, Gray300 `#E0E0E0`, Gray400 `#BDBDBD`,
Gray500 `#9E9E9E`, Gray600 `#757575`, Gray700 `#444444`, Gray800 `#32373C`,
Gray900 `#1A1A1A`, Gray950 `#0F0F0F`.

Semantic tokens (light / dark), from `FoskaBrand.lightColors` / `darkColors`:

| Token | Light | Dark |
|---|---|---|
| `background` | White | Black |
| `surface` | White | Gray950 |
| `surface-elevated` | Gray100 | Gray900 |
| `surface-highest` | Gray200 | Gray800 |
| `text-primary` | Black | White |
| `text-secondary` | Gray600 | Gray400 |
| `text-accent` | BrandRedLight | BrandRedLight |
| `accent` | BrandRed | BrandRed |
| `on-accent` | White | White |
| `action-primary` | Black | White |
| `on-action-primary` | White | Black |
| `action-secondary` | Gray100 | Gray900 |
| `on-action-secondary` | Black | White |
| `success` | #2E7D32 | #2E7D32 |
| `warning` | #F9A825 | #F9A825 |
| `error` | #CF2E2E | #CF2E2E |
| `outline` | Gray300 | Gray700 |
| `outline-subtle` | Gray200 | Gray800 |

Categorical (charts/tags): `#CF2E2E`, `#5B8DEF`, `#E3A13B`, `#58B368`, `#B06AC9`, `#4FB6C4`.

Implemented as CSS custom properties in `design/tokens.css` under `:root` (light) and a
`@media (prefers-color-scheme: dark)` block (MVP: **system preference only**, no toggle).
Tailwind theme `extend.colors` maps names (`bg-surface`, `text-primary`, `bg-accent`,
`bg-action-primary`, `border-outline`, …) onto `var(--…)`.

### 4.2 Type scale (ported from `DsTypography`)

System font stack (mobile uses the platform default — no custom webfont). Preserve the
app's **signature oversized ExtraBold metric styles with tight negative tracking**:

| Style | size / line-height / weight / tracking |
|---|---|
| displayLarge | 36 / 40 / 800 / -1 |
| displayMedium | 28 / 32 / 800 / -0.5 |
| headlineLarge | 24 / 28 / 700 / -0.25 |
| headlineMedium | 20 / 24 / 700 / 0 |
| titleLarge | 18 / 22 / 600 / 0 |
| titleMedium | 15 / 20 / 600 / 0 |
| bodyLarge | 15 / 22 / 400 / 0 |
| bodyMedium | 13 / 18 / 400 / 0 |
| labelLarge | 13 / 16 / 600 / 0.5 |
| **metricLarge** | 44 / 48 / 800 / -1.5 |
| **metricMedium** | 28 / 32 / 800 / -0.5 |
| **metricSmall** | 18 / 22 / 700 / 0 |

(px = the mobile sp values 1:1.) Expose as Tailwind text utilities or a small set of
typography component variants.

### 4.3 Shape / spacing / size tokens

- Radius: xs 4, sm 6, md 8, lg 10, xl 12, xxl 16, full 9999 (px).
- Spacing scale: xs 4, sm 8, md 12, lg 16, xl 24, xxl 32 (px).
- Sizes: touch target 48, button height 56 (compact 48), large icon 48 (px).

### 4.4 Primitives (`src/components/ui/`, mirror the `Ds*` set)

`Button` (primary = action-primary black/white, secondary), `Card`, `Input`, `Chip`,
`SectionHeader`, `StatRow`, `MetricValue` (uses metric type styles), `MacroRing`
(SVG circular progress: consumed vs target, with center metric readout),
`TopBar`, `BottomNav`, `EmptyState`, `Shimmer` (skeleton).

## 5. Information architecture & routes

Mobile-first app shell: `TopBar` (brand) + scrollable content + `BottomNav`. Nutrition is
the first (and, for MVP, only populated) section; the shell is structured so other tabs
(home/workouts/profile) can be added later.

| Route | Screen | Content |
|---|---|---|
| `/login` | Login | enter email → send OTP |
| `/verify` | Verify | enter code → session |
| `/nutrition` (index `/` → redirect) | **Hub / Today** | daily macro rings (consumed vs targets), "Log meal" CTA, featured recipes carousel, entry cards → Plan / Recipes / History |
| `/nutrition/plan` | **Meal Plan** | day-of-week selector (0=Mon…6=Sun; `day_of_week == null` = every day), meal cards (name, time_of_day) with foods + per-meal macro totals |
| `/nutrition/recipes` | **Recipes** | list; favorites toggle (show-only-favorites); featured surfaced first |
| `/nutrition/recipes/:id` | **Recipe Detail** | photo, macros, ingredients, numbered steps |
| `/nutrition/history` | **History** | past `meal_logs` grouped by date, each with totals |
| `/nutrition/history/:id` | **History Detail** | logged foods + totals + notes |
| `/nutrition/log` | **Log a meal** | search `foods` (ilike), portion picker scales macros by amount, name the meal, save |

`RouteGuard` wraps all `/nutrition/*` routes.

## 6. Data layer — Supabase contracts (mirror `MealRemoteDataSource`)

All via supabase-js PostgREST. Column names are the **DB truth** (snake_case). Domain-model
field mapping matches the KMP DTOs.

### 6.1 Reads

- **Active meal plan:**
  `from('meal_plans').select('*, meals(*, meal_foods(*))').eq('is_active', true).limit(1)`
  (RLS restricts to plans assigned to the user via `user_meal_plans`; no user filter needed.)
  - `meal_plans`: `id, name, description, valid_from, valid_to`
  - `meals`: `id, meal_plan_id, name, time_of_day, sort_order, day_of_week`
  - `meal_foods`: `id, meal_id, name, amount_grams, calories, protein_g, carbs_g, fat_g`
- **Recipes list:** `from('recipes').select('*')`
  - `recipes`: `id, name, description, calories, protein_g, carbs_g, fat_g, photo_url, prep_time_min, cook_time_min, servings, difficulty, tags, featured`
  - ⚠️ Column names differ from the domain model: `photo_url` (not image_url), `prep_time_min`, `cook_time_min`, `featured` (not is_featured).
- **Recipe detail:** `from('recipes').select('*, recipe_ingredients(*), recipe_steps(*)').eq('id', id).single()`; order steps by `step_number`, ingredients by `sort_order`.
  - `recipe_ingredients`: `id, recipe_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order`
  - `recipe_steps`: `id, recipe_id, step_number, instruction`
- **Meal history:** `from('meal_logs').select('*, meal_log_foods(*)').eq('user_id', uid).order('logged_at', {ascending:false})`
- **Day's logs (for summary):** same, `.gte('logged_at', '<date>T00:00:00Z').lt('logged_at', '<date+1>T00:00:00Z')`
  - `meal_logs`: `id, user_id, meal_name, notes, image_url, logged_at`
  - `meal_log_foods`: `id, meal_log_id, name, amount, unit, amount_grams, calories, protein_g, carbs_g, fat_g`
- **Food search:** `from('foods').select('*').ilike('name', '%<q>%').limit(20)`
  - `foods`: `id, name, calories, protein_g, carbs_g, fat_g, serving_size, serving_unit, brand, is_verified`
- **Favorites:** `from('recipe_favorites').select('recipe_id').eq('user_id', uid)`

### 6.2 Writes

- **Log meal** (`useLogMeal` mutation, two-step, mirrors `LogMealUseCase`):
  1. `insert into meal_logs { user_id, meal_name, logged_at (now ISO), notes, image_url:null }` → select → get `id`
  2. `insert into meal_log_foods [{ meal_log_id, name, amount, unit, amount_grams, calories, protein_g, carbs_g, fat_g }]`
     - ⚠️ **Populate both `amount` + `unit` AND `amount_grams`** (the insert DTO keeps `amount_grams` populated for now).
  3. Invalidate the day's summary + history queries.
- **Toggle favorite:** upsert `{ user_id, recipe_id }` / delete matching row.

### 6.3 Daily summary (client-computed, mirrors mobile)

Sum `calories/protein_g/carbs_g/fat_g` across the day's `meal_log_foods`. No server aggregation.

### 6.4 Macro targets (mirror `CalculateMacroTargetsUseCase`)

From `profiles` (`weight_kg, height_cm, age, goal, activity_level`); null any → no targets (hide rings' target arc).

```
bmr   = 10*weight_kg + 6.25*height_cm - 5*age + 5      // Mifflin–St Jeor, male constant (no sex field yet)
tdee  = bmr * activityMultiplier
kcal  = tdee * goalAdjustment
protein_g = weight_kg * 1.8
fat_g     = kcal * 0.25 / 9
carbs_g   = max(0, (kcal - protein_g*4 - fat_g*9) / 4)
```
- activityMultiplier: sedentary 1.2, lightly_active 1.375, moderately_active 1.55, active 1.725, very_active 1.9
- goalAdjustment: lose_weight 0.85, build_muscle 1.10, get_stronger 1.05, stay_fit/null 1.0

### 6.5 Query hooks (`src/hooks/`)

`useActiveMealPlan`, `useRecipes`, `useRecipe(id)`, `useMealHistory`, `useDailyLogs(date)`,
`useDailySummary(date)` (derived), `useMacroTargets` (from profile), `useFoodSearch(query)`,
`useFavorites` + `useToggleFavorite`, `useLogMeal` (mutation). Each is a thin supabase-js
call + React Query key; TS row types cloned into `src/types/database.ts`.

## 7. Auth (email OTP only)

Reuse admin's Supabase auth: `supabase.auth.signInWithOtp({ email })` on Login →
`supabase.auth.verifyOtp({ email, token, type: 'email' })` on Verify. Session persisted in
localStorage (admin's client config). `useAuth` exposes `{ session, user, profile, isLoading }`
(no `isAdmin`). `RouteGuard` sends unauthenticated users to `/login`. No Google/Apple.

## 8. Responsive & UX

Mobile-first single column with touch-sized targets and a bottom nav. On ≥`md` the same
content centers in a phone-width column (max ~480–560px) so desktop reads like the app.
framer-motion for route/tab transitions and macro-ring fills. `Shimmer` skeletons on every
async surface. Optimistic UI on favorite toggle; on successful meal-log, navigate back to the
Hub and show the updated summary.

## 9. Testing

Vitest + Testing Library (clone admin `test-setup.ts`). Cover:
- **portion-scaling math** (amount → scaled macros) — pure unit
- **daily macro summing** — pure unit
- **macro-target formula** — pure unit (table of profiles → expected targets)
- query hooks against a mocked supabase client (happy path + empty/error)
- smoke-render each screen with mock data (loading / loaded / empty states)

## 10. Out of scope (MVP boundaries)

No backend/schema/RLS changes. No photo meal analysis, no barcode lookup. No workouts /
home / profile tabs. No admin restyle. No Google/Apple auth. No dark/light **toggle**
(system preference only). No i18n work beyond copying the app's existing Slovak/locale strings
as needed.

## 11. Assumptions to confirm during planning

1. `recipe_favorites`, `foods`, `meal_logs`, `meal_log_foods`, `user_meal_plans` all have RLS
   policies that permit an authenticated non-admin user to read/write **their own** rows
   (mobile already relies on this; verify no admin-only policy blocks the web anon+user path).
2. Netlify: a second site pointed at `webapp/` with the same Supabase env vars; SPA redirect
   (`/* → /index.html`) as in admin's `netlify.toml`.
3. Locale: confirm whether user-facing copy should be Slovak (coach's audience) from day one;
   if so, reuse the mobile app's existing strings.
