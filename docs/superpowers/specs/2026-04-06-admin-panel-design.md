# Coach Foska — Admin Panel Design Spec
**Date:** 2026-04-06  
**Status:** Approved  

---

## Overview

A standalone web application in the `admin/` folder of the Coach Foska monorepo. It consists of a public marketing landing page and a protected admin panel for managing users, workouts, nutrition, and coach quotes. Deployed to Netlify.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + Vite + TypeScript |
| Routing | React Router v6 |
| Data fetching / caching | TanStack Query v5 |
| Backend | Supabase JS SDK v2 (Auth, Postgrest) |
| Styling | Tailwind CSS v4 |
| Deployment | Netlify (static build, `netlify.toml` with security headers) |

---

## Security Requirements

These are non-negotiable and must be implemented from the start:

- **CSP headers** via `netlify.toml` — restrict script-src, style-src, connect-src to known origins only.
- **No tokens in URLs** — Supabase session tokens must never appear in query parameters or hash fragments accessible to third parties.
- **Route guards** — all `/admin/*` routes check `is_admin` before rendering. Non-admin authenticated users get a 403 page, not a redirect loop.
- **Admin check via RLS** — the `is_admin()` Supabase function enforces access at the database level; the frontend check is UX-only and not trusted for data access.
- **No auth tokens in localStorage** — use Supabase's in-memory session storage (`storage: undefined` in client config). Non-sensitive preferences (theme) may use `localStorage`.
- **OTP-only auth** — no password input anywhere in the app. Email OTP via Supabase magic link / OTP.
- **Supabase client** — single shared instance, initialized once, never re-created per component.

---

## Routes

```
/                   → Landing page (public)
/auth               → Login — email OTP entry
/auth/verify        → OTP code verification (6-digit)
/auth/callback      → Supabase redirect handler (exchanges token, then redirects)
/403                → Access denied (authenticated but not admin)
/admin              → Dashboard (protected: is_admin required)
/admin/users        → User management
/admin/users/:id    → User detail (slide-over panel or nested route)
/admin/workouts     → Workout plans + exercise builder
/admin/nutrition    → Recipes + meal plans (sub-tabs)
/admin/quotes       → Quote management
```

**Route guard logic:**
1. No session → redirect to `/auth`
2. Session exists, `is_admin = false` → redirect to `/403`
3. Session exists, `is_admin = true` → render admin layout

---

## Landing Page (`/`)

A full marketing page targeting potential clients. Sections in order:

1. **Nav** — Logo left, links (About, Features, How it works), Login button right. Sticky, blur backdrop.
2. **Hero** — Large headline, subheadline, two CTAs: "Download the app" (primary) + "Learn more" (secondary). Badge showing platform availability.
3. **App preview** — Three phone frames showing workout, nutrition, and progress screens.
4. **Features grid** — 3×2 grid: Personalised Workouts, Nutrition Guidance, Progress Tracking, Daily Motivation, Android & iOS, Private & Secure.
5. **How it works** — 4-step horizontal flow: Download & sign up → Complete onboarding → Get your plan → Train & track.
6. **Coach quote banner** — Pulls the currently active quote from `daily_quotes` (via public Supabase query). Falls back to a static default if none active.
7. **Footer** — Logo, links (Privacy Policy, Terms, Contact), copyright.

**Theme:** Dark by default (`#0a0a0a` base). The landing page does not have a theme toggle — it is always dark to maintain brand consistency.

---

## Auth Flow (`/auth`, `/auth/verify`, `/auth/callback`)

### Login page (`/auth`)
- Email input + "Send login code" button.
- On submit: calls `supabase.auth.signInWithOtp({ email })`.
- Redirects to `/auth/verify` on success.
- Shows inline error on failure (rate limit, invalid email).
- Note: "Admin access is required to use this panel."

### Verify page (`/auth/verify`)
- 6-digit OTP input (auto-focus, auto-advance between digits).
- On submit: calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
- On success: runs role gate → `/admin` or `/403`.
- Resend code link with 60-second cooldown.

### Callback (`/auth/callback`)
- Handles Supabase's redirect-based flow (magic link fallback).
- Exchanges URL hash/fragment for session, then runs role gate.
- Never exposes raw tokens in the URL after processing.

---

## Admin Layout

Persistent shell wrapping all `/admin/*` routes:

- **Left sidebar (200px):** Logo, nav items (Dashboard, Users, Workouts, Nutrition, Quotes), spacer, dark/light mode toggle, user avatar + email + sign out.
- **Top bar:** Page title, contextual action buttons (e.g., "+ Create" on relevant pages).
- **Main content area:** Scrollable, padded.
- **Dark/light mode:** Toggle in sidebar. Dark is default. Preference persisted in `localStorage`. Implemented via CSS custom properties on `[data-theme]` attribute on `<html>`.

---

## Admin Tabs

### Dashboard (`/admin`)

Stats row (4 cards): Total Users, Workout Plans, Meal Plans, Recipes.  
Active Quote panel — shows current active quote text + author + since date.  
Two panels side by side:
- **Recent Activity** — last 10 events (workout logged, user registered, plan updated). Read from `workout_logs`, `profiles`, `meal_plans` ordered by `created_at`. Admin-only via RLS.
- **Quick Actions** — buttons: Create workout plan, Add recipe, Create meal plan, Update active quote. Each navigates to the relevant tab.

---

### Users (`/admin/users`)

**List view:**
- Search input (filters by name or email, client-side after fetch).
- Table columns: User (avatar + name + email), Goal, Workout Plan, Meal Plan, Status badge (Active / Inactive / Blocked), Joined date, View action.
- Status badge colours: Active = green, Inactive = grey, Blocked = red.
- Pagination or infinite scroll (TanStack Query `useInfiniteQuery`).

**User detail (slide-over panel, `/admin/users/:id`):**
- Profile info: full name, email, age, height, weight, goal, activity level.
- Onboarding complete status.
- Assign workout plan — dropdown of existing plans → calls update on `workouts` table setting `user_id`.
- Assign meal plan — dropdown of existing plans → calls update on `meal_plans` table setting `user_id`.
- Weight history — simple list of `weight_entries` ordered by date.
- Admin notes — free text, saved to `profiles.admin_notes`.
- Block / Unblock toggle — sets `profiles.is_blocked`.

---

### Workouts (`/admin/workouts`)

**Plan list:**
- Cards or table of all workout plans. Columns: Name, Day of Week, Assigned To (user or "Global template"), Exercise count, Active status.
- "+ Create plan" button opens plan editor.

**Plan editor (modal or nested route):**
- Fields: Name, Day of week (Mon–Sun or "Any"), Notes, Active toggle.
- Exercise list (ordered, drag-to-reorder optional v2):
  - Each exercise: Name, Muscle group, Sets, Reps, Rest (seconds), Tips.
  - Add exercise button appends a blank row.
  - Delete exercise (with confirmation).
- Save creates/updates `workouts` + `workout_exercises` in a single logical operation (upsert exercises, delete removed ones).
- Assign to user or leave `user_id = null` (global template).

---

### Nutrition (`/admin/nutrition`)

Two sub-tabs: **Recipes** and **Meal Plans**.

**Recipes sub-tab:**
- Recipe list: Name, Calories, Protein, Carbs, Fat, Prep time, Servings, Edit/Delete actions.
- "+ Add recipe" opens recipe editor.
- Recipe editor:
  - Fields: Name, Description, Prep time (min), Servings.
  - Macro summary (auto-calculated from ingredients): Calories, Protein, Carbs, Fat.
  - Ingredient list: Name, Quantity, Unit, Calories, Protein, Carbs, Fat per ingredient. Add/remove rows.
  - Save creates/updates `recipes` + `recipe_ingredients`.

**Meal Plans sub-tab:**
- Plan list: Name, Description, Valid From, Valid To, Assigned To, Active status.
- "+ Create meal plan" opens plan editor.
- Meal plan editor:
  - Fields: Name, Description, Valid From / To dates, Active toggle.
  - Meal slots: each slot has Name, Time of day, sort order.
  - Each slot links recipes via `meal_plan_recipes` (meal type + optional day of week).
  - Recipe picker: searchable dropdown from the recipe library.
  - Assign to user or leave as global template.

---

### Quotes (`/admin/quotes`)

- Quote list: Text (truncated), Author, Scheduled Date, Active badge.
- Only one quote can be `is_active = true` at a time. Setting a new quote active automatically deactivates the previous one (handled server-side via a Supabase function or enforced by the admin UI with an optimistic update + confirmation).
- "+ Add quote" opens quote editor (text, author, optional scheduled date).
- Edit / Delete actions per row.
- "Set active" button on each inactive quote row.

---

## Light Mode

All components must support both themes via CSS custom properties. Key token pairs:

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0d0d0d` | `#ffffff` |
| `--bg-card` | `#161616` | `#f5f5f5` |
| `--border` | `#1e1e1e` | `#e5e5e5` |
| `--text` | `#e5e5e5` | `#111111` |
| `--text-muted` | `#555555` | `#888888` |
| `--sidebar-bg` | `#0d0d0d` | `#fafafa` |

Accent colours (status badges, success indicators) remain consistent across themes.

---

## Project Structure

```
admin/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── netlify.toml          ← security headers, redirect rules
├── package.json
├── src/
│   ├── main.tsx
│   ├── App.tsx           ← router setup
│   ├── lib/
│   │   ├── supabase.ts   ← single Supabase client instance
│   │   └── queryClient.ts← TanStack Query client config
│   ├── hooks/
│   │   ├── useAuth.ts    ← session, role check
│   │   └── useTheme.ts   ← dark/light toggle + persistence
│   ├── components/
│   │   ├── AdminLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── RouteGuard.tsx
│   │   └── ui/           ← Button, Badge, Input, Table, Modal, SlideOver
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── Verify.tsx
│   │   ├── Callback.tsx
│   │   ├── NotAdmin.tsx
│   │   └── admin/
│   │       ├── Dashboard.tsx
│   │       ├── Users.tsx
│   │       ├── UserDetail.tsx
│   │       ├── Workouts.tsx
│   │       ├── Nutrition.tsx
│   │       └── Quotes.tsx
│   └── types/
│       └── supabase.ts   ← generated Supabase types
```

---

## Netlify Config (`netlify.toml`)

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; img-src 'self' data:; frame-ancestors 'none';"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Out of Scope (this iteration)

- Client UI (`/client/*` routes)
- Push notifications
- Chat / messaging
- Analytics dashboard beyond basic stats
- Multi-coach support
- File/image uploads (coach avatar, exercise images)
