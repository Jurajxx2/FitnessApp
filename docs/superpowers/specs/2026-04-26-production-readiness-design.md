# Coach Foška — Production Readiness Spec

> Analysis date: 2026-04-26  
> Analyst role: Senior Product Analyst  
> Research: MyFitnessPal, Strong, Trainerize/ABC, TrueCoach, Fitbod, RP Diet, Nike Training Club (2 rounds)  
> Scope: All features, user flows, and requirements needed to ship a production-ready fitness coaching app

---

## Current State Summary

| Area | Built | Quality |
|---|---|---|
| Auth (Email OTP, Google/Apple) | ✅ | Solid |
| Onboarding (goal, body stats, activity) | ✅ | Minimal — needs depth |
| Home dashboard | ✅ | Missing targets/progress bars |
| Workout list & detail | ✅ | Solid read-only view |
| Active workout session | ⚠️ Partial (screen exists) | Flow disconnected from plan |
| Exercise library | ✅ | Solid |
| Workout log (manual) | ✅ | Broken UX — blank form |
| Workout history | ✅ | Good |
| Nutrition hub & meal plan | ✅ | Solid read view |
| Meal logging | ⚠️ Partial | Food DB migration exists; logging UI incomplete |
| Recipe detail | ✅ | Missing "Log This Meal" |
| Hydration tracking | ✅ | Basic, complete |
| AI Coach chat | ✅ | Solid |
| Human coach chat (realtime) | ✅ | Solid |
| Profile / weight progress | ✅ | Weight only — missing measurements, photos |
| Settings / account management | ❌ Missing | No screen, no route |
| Push notifications | ❌ Missing | Device tokens table exists, no delivery |

---

## Feature 1 — Active Workout Session

**Status:** Screen file exists (`ActiveSessionScreen.kt`, `ActiveSession(workoutId)` route) but flow is not wired end-to-end.

### Required Flow
```
WorkoutDetail → [START WORKOUT]
  └── ActiveSession
      ├── Progress header: Exercise 2 of 5 · 38:14 elapsed
      ├── Current exercise card
      │   ├── Exercise name + muscle group chip
      │   ├── Video/GIF thumbnail (from ExerciseDetail data)
      │   ├── Prescribed: 3 sets × 10 reps @ 60 kg
      │   └── Set rows (logged inline):
      │       ├── Previous session ghost: "Last: 60 kg × 8" (greyed)
      │       ├── Set 1  [weight kg] [reps]  [✓ Done]
      │       ├── Set 2  [weight kg] [reps]  [✓ Done]  ← auto-fills weight from set 1
      │       └── Set 3  ...
      ├── Rest timer (auto-starts after each set ✓)
      │   ├── Countdown ring — default 90 s, customisable per exercise
      │   ├── [Skip] / [+30s] buttons
      │   └── Vibration + sound on timer end
      ├── [Next Exercise →] or swipe
      └── [Finish Workout] → Session Summary screen
          ├── Duration: 58 min
          ├── Total volume: 8,450 kg lifted
          ├── PRs hit: "Bench Press — new 8RM: 65 kg 🏆"
          ├── Exercises completed: 5/5
          └── [Save & Exit] → writes WorkoutLog → visible in history and to coach
```

### Requirements
- Pre-fill all exercises from the assigned workout plan (pass `workoutId`)
- Show previous session's weight/reps as ghost text per set
- Rest timer: configurable globally (Settings) and per-exercise
- Auto-advance to next exercise when all sets are completed
- PR detection: compare current e1RM against stored max for that exercise; celebrate inline with badge
- Persist session in-progress locally — allow resume if app is backgrounded
- "Add extra set" button per exercise
- In-session notes per exercise (text field, collapsible)
- Incomplete session: prompt on back press "Save as incomplete?" — saves partial log
- Volume calculation: weight × reps summed across all sets

### UX Patterns (from Strong, Fitbod)
- Inline set rows — tap to mark done, not a separate confirm sheet
- Rest timer is a non-blocking overlay, not a modal that hides the exercise
- Previous session numbers shown as input placeholder text
- Haptic feedback on set completion

---

## Feature 2 — Food Database + Meal Logging

**Status:** `food_database` Supabase migration exists (2026-04-25). `MealCaptureScreen.kt` has manual entry. Search UI and integration are incomplete.

### Required Flow — Free Logging
```
Nutrition → [+ Log Meal]
  └── Meal type selector: Breakfast / Lunch / Dinner / Snack
      └── Search bar: "chicken breast"
          ├── Results from food_database (name, brand, kcal/100g)
          ├── Barcode scanner icon → camera → auto-lookup
          └── [Select] → Portion screen
              ├── Serving size selector: g / ml / pieces / cups
              ├── Quantity input with real-time macro recalculation
              │   ├── Calories: 330 kcal
              │   ├── Protein: 62g
              │   ├── Carbs: 0g
              │   └── Fat: 7.2g
              └── [Add to Meal] → back to meal builder
                  └── Add more items OR [Save Meal] → writes NutritionLog
```

### Required Flow — Log from Meal Plan
```
Nutrition → Today's Meal Plan → [Breakfast: Avocado Egg Toast]
  └── MealDetail
      └── [LOG THIS MEAL] button
          └── Pre-filled MealCapture with all recipe ingredients and macros
              ├── Each food item shown with calculated macros
              ├── User can adjust portions or remove items
              └── [Save] → writes NutritionLog
```

### Required Flow — Log from Recipe
```
RecipeDetail → [Log This Recipe]
  └── Same pre-fill flow as above
```

### Requirements
- Food search: instant results, debounced (300 ms), minimum 2 chars
- Show all 4 macros (kcal, protein, carbs, fat) — currently carbs + fat missing from `FoodEntryRow`
- Barcode scanner: use camera permission; query by barcode EAN/UPC against food_database — requires adding `barcode TEXT UNIQUE` column to `foods` table (new migration needed)
- Portion units: g, ml, piece, serving (mapped per food item)
- Recent foods list (last 20 unique foods logged — persisted locally)
- Favourite foods bookmark
- Custom food creation: name + macros per 100g → saved to local custom_foods
- Daily macro summary on NutritionHub with target progress bars (see Feature 3)
- Meal history shows full breakdown: each food item, not just totals

---

## Feature 3 — Daily Macro Targets + Home Dashboard

**Status:** Home shows raw macro totals. No targets. Progress bars missing.

### Required Home Nutrition Card
```
Nutrition Today
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Calories  1,840 / 2,150 kcal   ████████░░  86%
Protein    165g / 200g          ████████░░  83%
Carbs      210g / 250g          ████████░░  84%
Fat         52g / 65g           ████████░░  80%
Water      1.8L / 2.5L          ███████░░░  72%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[+ Log Meal]           [Details →]
```

### Target Calculation Logic
1. Primary: coach-set targets stored in `user_profiles` (coach overrides)
2. Fallback: TDEE formula from onboarding data (weight, height, age, activity level, goal)
   - TDEE Mifflin-St Jeor + activity multiplier
   - Goal modifier: -300 kcal (cut), +0 (maintain), +300 kcal (bulk)
   - Protein: 2.0 g/kg body weight (or coach-set)
   - Fat: 25% of TDEE calories
   - Carbs: remainder

### Requirements
- Coach can set per-client macro targets from admin panel (overrides TDEE)
- User can view (not edit) their targets in Profile → Nutrition Targets
- Targets update automatically when body weight changes (TDEE recalculation)
- Colour coding: green ≥ 80%, amber 60–79%, red < 60%
- Over-target: grey overflow bar, no alarming colours (MFP pattern)

---

## Feature 4 — Progress Tracking (Measurements + Photos)

**Status:** `ProgressScreen.kt` exists with weight chart only. No measurements, no photos.

### 4a — Body Measurements

#### Flow
```
Profile → Progress → [Measurements tab]
  └── Measurements screen
      ├── Quick-add row: [+ Today]
      │   └── Measurement entry sheet
      │       ├── Weight (kg/lbs) — already logged via existing flow
      │       ├── Body fat % (optional)
      │       ├── Waist (cm)
      │       ├── Chest (cm)
      │       ├── Hips (cm)
      │       ├── Left arm / Right arm (cm)
      │       ├── Left thigh / Right thigh (cm)
      │       └── [Save]
      └── Per-metric graphs (line chart)
          ├── Tap metric → full-screen graph with date range picker
          └── Latest vs. start delta: "Waist: -4.2 cm since Jan 1"
```

#### Requirements
- Configurable units: metric (kg, cm) or imperial (lbs, inches) — set in Settings
- Only show enabled metrics (user selects which ones to track in Settings)
- Coach can view all measurements in admin panel per client

### 4b — Progress Photos

#### Flow
```
Profile → Progress → [Photos tab]
  ├── [+ Add Photos] → Camera / Gallery picker
  │   ├── Angle selector: Front / Side / Back
  │   └── Confirm → auto-date-stamped, uploaded to Supabase Storage
  └── Gallery view: grid of cards, newest first
      ├── Tap photo → full-screen with date
      └── [Compare] → side-by-side picker
          ├── Pick Photo A (older)
          ├── Pick Photo B (newer)
          └── Split-screen comparison with dates
```

#### Requirements
- Photos stored in Supabase Storage bucket `progress-photos` with RLS (user sees own only)
- Coach can view client's progress photos in admin
- Reminder prompt: "Add progress photos every Sunday" (configurable in Settings)
- Photos private by default — explicit share option for sending to coach (in chat)

---

## Feature 5 — Onboarding (Enhanced)

**Status:** 4-step onboarding exists (goal, body stats, activity, complete). Missing: diet preferences, notifications opt-in, coach pairing, deeper personalization.

### Revised Onboarding Flow
```
Welcome screen
  └── Auth (Email OTP / Google / Apple)
      └── Onboarding (triggered for new users)
          ├── Step 1: Goal  [Lose fat / Build muscle / Improve fitness / Stay active]
          ├── Step 2: Body stats  [Weight, Height, Age, Sex]
          ├── Step 3: Activity level  [Sedentary / Light / Moderate / Active / Very active]
          ├── Step 4: Training experience  [Beginner / Intermediate / Advanced]
          ├── Step 5: Diet style  [No restrictions / Vegetarian / Vegan / Halal / Other]
          ├── Step 6: Notifications opt-in
          │   ├── "Get reminders for workouts and meals?"
          │   ├── [Turn on reminders] → requests OS permission
          │   └── [Not now] → skippable
          └── Step 7: Complete → show personalised macro targets preview
              └── "Your coach will review your profile and assign your first plan"
```

### Requirements
- Progress indicator (7 dots / steps) throughout
- All steps skippable except goal + body stats (minimum viable profile)
- Diet style stored in `user_profiles` — coach sees it in admin
- Training experience stored — affects workout difficulty defaults
- Notification opt-in step only shown if OS permission not yet granted
- Re-entry: if user exits mid-onboarding, resume from last completed step

---

## Feature 6 — Push Notifications

**Status:** `device_tokens` table exists (migration 2026-04-23). No notification delivery implemented.

### Notification Types and Triggers

| Type | Trigger | Content |
|---|---|---|
| Workout reminder | Daily at user's preferred workout time | "Time for your workout: Push Day A 💪" |
| Meal reminder | 3× daily at configured meal times | "Log your lunch — you're 800 kcal short of target" |
| Hydration reminder | Every 2h between 8 AM – 8 PM (if below target) | "Drink some water — 0.8L left for today 💧" |
| Coach message | New message in human coach thread | "[Coach Name]: Hey, great session today!" |
| Weekly check-in | Every Sunday at 9 AM | "Time for your weekly check-in with [Coach Name]" |
| PR achieved | End of active session when PR detected | "New PR on Bench Press — 65 kg × 8! 🏆" |
| Streak milestone | On completing nth consecutive day | "7-day streak! You're on a roll 🔥" |
| Inactivity re-engagement | 3 days with no app open | "Missing you — your coach has a new workout ready" |

### Requirements
- Notification preferences screen (Settings → Notifications):
  - Toggle per category (workout, meal, water, coach, streaks)
  - Workout reminder time picker
  - Meal reminder time pickers (breakfast, lunch, dinner)
- Use FCM (Android) + APNs (iOS) via Supabase Edge Function or direct API
- Deep-link from notification to the relevant screen
- Rate limiting: max 5 notifications/day to avoid user fatigue
- Respect OS Do Not Disturb; use low-priority channel for non-urgent messages

---

## Feature 7 — Weekly Check-In Flow

**Status:** Not implemented. Referenced in fitness-coach-analysis.md as high priority.

### Flow
```
Sunday 9 AM push notification: "Weekly check-in with [Coach Name]"
  └── Check-In screen (accessible from notification deep-link OR Profile → Check-in)
      ├── How was your energy this week?     [1–5 star rating]
      ├── Average sleep per night?           [< 6h | 6–7h | 7–8h | 8h+]
      ├── Workout compliance?               [All / Most / Some / None]
      ├── Nutrition compliance?             [Mostly on track / Sometimes off / Struggled]
      ├── Current body weight                [input — pre-fills from last log]
      ├── Notes for your coach              [multiline text, optional]
      └── [Send to Coach]
          └── Creates structured message in HumanCoachChat thread:
              "📊 Weekly check-in — Apr 20–26
               Energy: ⭐⭐⭐⭐ | Sleep: 7–8h | Workouts: Most | Nutrition: On track
               Weight: 82.3 kg
               Notes: Shoulder felt tight on pressing movements"
```

### Requirements
- Check-in history visible in Profile → Progress → Check-ins tab
- Coach sees check-ins in admin panel per client with trend indicators
- Skip option with reason (travel, illness, etc.)
- Reminder resent Monday morning if Sunday check-in missed

---

## Feature 8 — Streak & Consistency Tracking

**Status:** Not implemented.

### Flow
```
Home screen — streak widget:
  ├── Current streak: 🔥 14 days
  ├── Consistency heatmap (GitHub-style): last 12 weeks of activity
  │   ├── Green = workout logged
  │   ├── Blue = nutrition logged (partial credit)
  │   └── Grey = nothing logged
  └── Tap → full Consistency screen
      ├── Longest streak: 21 days
      ├── This month: 18/26 active days
      └── Milestones: [7 days ✅] [14 days ✅] [30 days 🔒] [90 days 🔒]
```

### Requirements
- Streak counts day as active if ≥ 1 workout OR ≥ 2 meals logged
- Grace period: 1 day miss does not break streak if user has used "streak freeze" (1 available per 7-day streak)
- Milestones: 7, 14, 30, 60, 90, 180 days with distinct badges
- Badges saved to `user_achievements` table (new)
- Coach sees compliance stats in admin

---

## Feature 9 — Cardio / Steps Logging

**Status:** Not implemented. No cardio route in navigation.

### Flow
```
Activity tab → [+ Log Cardio]
  └── Cardio type: Running / Cycling / Walking / Swimming / Other
      ├── Manual entry:
      │   ├── Duration: [mm:ss]
      │   ├── Distance: [km/miles] (optional)
      │   ├── Avg heart rate (optional)
      │   └── Notes
      └── [Save] → writes to cardio_logs table
          └── Home screen shows cardio in activity summary

Activity tab → [+ Log Steps]
  └── Steps: [10,234] → [Save]
      └── Auto-populated from HealthKit (iOS) / Health Connect (Android) if permitted
```

### Requirements
- Estimated calories burned (MET formula) added to daily calorie burn
- Home screen activity card shows steps + cardio + strength training
- Integration: Apple HealthKit (iOS) + Google Health Connect (Android) for steps/distance/HR
- Coach sees cardio logs in admin

---

## Feature 10 — Settings & Account Management

**Status:** No Settings route exists in `Routes.kt`. This is a critical gap — required for App Store compliance.

### Settings Screen Structure
```
Settings
├── Profile
│   ├── Edit profile (name, avatar)
│   ├── Body stats (update weight, height, age)
│   └── Nutrition targets (view coach-set / TDEE-calculated targets)
├── Units
│   ├── Weight: kg / lbs
│   ├── Height: cm / ft+in
│   └── Distance: km / miles
├── Notifications
│   ├── Workout reminders (toggle + time)
│   ├── Meal reminders (toggle + times)
│   ├── Hydration reminders (toggle)
│   ├── Coach messages (toggle)
│   └── Weekly check-in (toggle)
├── Appearance
│   └── Theme: System / Light / Dark
├── Privacy & Data
│   ├── Privacy policy (web link)
│   ├── Terms of service (web link)
│   ├── Export my data (JSON download)
│   └── Delete account (with confirmation)
└── About
    ├── App version
    ├── Rate the app (store link)
    └── Contact support
```

### Account Deletion Flow (App Store / Google Play Requirement)
```
Settings → Privacy & Data → Delete Account
  └── Warning screen:
      "This permanently deletes your account, workouts, nutrition logs,
       progress photos, and messages. This cannot be undone."
      └── [Type "DELETE" to confirm]
          └── [Delete Account]
              ├── Calls Supabase RPC: delete_user_account(uid)
              │   ├── Deletes all user rows (cascade)
              │   ├── Deletes Storage objects (progress-photos/uid/*)
              │   └── Calls auth.admin.deleteUser(uid) via Edge Function
              └── Navigates to Welcome screen
```

### Data Export
- JSON file with: profile, workout logs, nutrition logs, measurements, check-ins
- Excludes: chat messages (privacy), progress photos (size — provide download link instead)
- Triggered via Supabase Edge Function → returns signed URL for download

---

## Feature 11 — Apple Health / Google Health Connect Integration

**Status:** Not implemented.

### Data Flows

**Write to Health platform:**
- Workouts logged → write workout session (type, duration, calories)
- Body weight logged → write body weight measurement
- Water intake → write water intake

**Read from Health platform:**
- Steps today → show on home screen
- Resting heart rate → show in profile (informational)
- Body weight → auto-suggest when logging measurements

### Requirements
- Permissions requested lazily (only when user taps "Connect to Health" in Settings)
- No silent background syncs without explicit permission
- iOS: HealthKit; Android: Health Connect API
- Clearly labelled in Settings → Integrations with current status (Connected / Disconnected)

---

## Feature 12 — Personal Records (PRs)

**Status:** Not implemented. Detected at session end in design (Feature 1) but no persistence.

### Data Model (new table: `personal_records`)
```
id, user_id, exercise_id, rep_range (e.g. "1","5","8","10"), weight_kg,
achieved_at, workout_log_id
```

### Flow
- On saving a session: for each exercise, compute e1RM (Epley formula: w × (1 + r/30))
- Compare against stored PR for that exercise + rep range
- If new max: write to `personal_records`, trigger in-app celebration, optionally notify coach
- PR history screen: list all exercises with best lifts and dates
- PRs visible in ExerciseDetail screen

---

## Feature 13 — Admin Panel Enhancements (Coach Side)

**Status:** Admin panel has Users, Nutrition, Chat. Missing: per-client progress dashboard, compliance tracking, body stats, check-in review.

### New Admin Features

**Client Dashboard (per client)**
```
/admin/clients/:id
├── Overview cards: last active, 7-day compliance %, current streak
├── Progress photos timeline
├── Body measurements chart
├── Weekly check-in history
├── Workout log history
├── Nutrition log history (macro trends)
└── [Assign New Workout Plan] / [Assign New Meal Plan]
```

**Compliance Dashboard (coach home)**
```
/admin/dashboard
├── All clients sorted by last active
├── Red flag: clients with < 50% compliance this week
├── Check-ins pending review
└── New PRs (across all clients)
```

**Macro Targets Editor**
```
/admin/clients/:id/targets
├── Set custom kcal, protein, carbs, fat targets
└── Override TDEE-calculated defaults
```

---

## Production Compliance Checklist

### App Store (iOS) Requirements
- [ ] Privacy Policy URL in App Store Connect listing
- [ ] NSPrivacyAccessedAPITypes in Privacy Manifest (HealthKit, Camera, Photo Library, Notifications)
- [ ] App Tracking Transparency prompt if any tracking used
- [ ] In-app account deletion flow (App Store Review Guideline 5.1.1)
- [ ] App Privacy Nutrition Labels accurate and complete

### Google Play Requirements
- [ ] Privacy Policy URL in Play Console listing
- [ ] Data Safety section completed (health data, personal data, financial data)
- [ ] In-app account deletion + web URL for deletion (Google Play policy since Dec 2023)
- [ ] Health Connect permissions declared if used
- [ ] Target API level meets current Play requirements

### Infrastructure / Security
- [ ] CSP headers on admin panel (see security-todo.md item 1)
- [ ] HTTPS enforced with HSTS (see security-todo.md item 2)
- [ ] Hardening headers: X-Frame-Options, X-Content-Type-Options (see security-todo.md item 3)
- [ ] RLS policies audited for all writable tables (see security-todo.md item 6)
- [ ] `npm audit` integrated in CI pipeline for admin
- [ ] Crash reporting: integrate Firebase Crashlytics (KMP) or Sentry
- [ ] Performance monitoring: app startup time, screen load times
- [ ] Remote config: feature flags for gradual rollout
- [ ] Analytics: event tracking (user activated, first workout logged, retention events)

### Localization
- [ ] All user-visible strings in string resources (no hardcoded English)
- [ ] Date/time formatting respects device locale
- [ ] Number formatting (decimal separator) respects locale
- [ ] RTL layout support tested (if targeting Arabic/Hebrew markets — defer if not)

---

## UX Patterns & Design Standards

### Navigation Model (current: bottom nav with 5 tabs)
Tabs: Home · Workout · Nutrition · Chat · Profile  
The existing model is correct. No changes needed to tab structure.

### Empty States
Every list/history screen must have a designed empty state with:
- Illustration or icon (not just blank space)
- Descriptive text: "No workouts logged yet"
- CTA button: "Log your first workout"

### Loading States
- Skeleton screens (not spinners) for all content-heavy screens
- Inline loading for search results (food search, exercise search)

### Error Handling
- Network errors: toast with retry action
- Form validation: inline red text below field, not generic dialog
- Session expired: auto-navigate to Welcome with explanatory toast

### Offline Mode
- Workout session MUST work offline (log sets locally, sync on reconnect)
- Hydration logging works offline
- Notification preferences work offline
- Food search: show "No results — check your connection" if DB unreachable
- Visible sync indicator on home screen when pending changes exist

### Accessibility
- Minimum touch target: 48 × 48 dp
- All interactive elements have content descriptions
- Colour contrast: WCAG AA (4.5:1 for text)
- Dynamic type support (scale with OS font size setting)

---

## Implementation Priority

### P0 — Blockers for launch (App Store / Play Store compliance)
1. Account deletion flow (Feature 10, sub-section)
2. Privacy policy + Terms of Service links in Settings
3. Settings screen (Feature 10) — required to surface the above
4. Data Safety / Privacy Nutrition Labels declared

### P1 — Retention-critical (without these, users churn in week 1)
5. Active workout session wired end-to-end (Feature 1)
6. Food database search in MealCapture (Feature 2)
7. Log from meal plan / recipe (Feature 2, second flow)
8. Daily macro targets + progress bars on home (Feature 3)

### P2 — Coaching relationship quality
9. Push notifications delivery (Feature 6) — device tokens exist
10. Weekly check-in flow (Feature 7)
11. Progress photos (Feature 4b)
12. Body measurements (Feature 4a)
13. PR detection and persistence (Feature 12)
14. Admin client dashboard enhancements (Feature 13)

### P3 — Depth and engagement
15. Streak / consistency heatmap (Feature 8)
16. Cardio / steps logging (Feature 9)
17. Apple Health / Google Health Connect (Feature 11)
18. Enhanced onboarding (Feature 5)
19. Offline workout session (UX patterns section)
20. Crash reporting + analytics infrastructure

### P4 — Polish and scale
21. Barcode scanner for food (Feature 2 enhancement)
22. In-session exercise notes (Feature 1 enhancement)
23. Data export (Feature 10)
24. Localization completeness audit
25. Accessibility audit (WCAG AA)
26. Admin compliance dashboard (Feature 13)

---

## Flows Not Covered by Competitors That Coach Foška Can Win On

1. **Coach-assigned plan → one-tap log**: competitors require manual re-entry. Coach Foška's architecture already has the meal plan → recipe → ingredients chain. "Log This Meal" is 2 days of work and a differentiator.

2. **Structured weekly check-in as a product feature**: Trainerize and TrueCoach do this as a forms tool bolted on. Building it natively as a chat-connected flow (check-in answers auto-posted to human coach thread) is a genuine UX advantage.

3. **Pre-loaded previous session numbers during active session**: Strong does this well; Trainerize does not. Since the app already has workout history, showing "last session: 60 kg × 8" as ghost text is a single query away and a meaningful differentiator for strength athletes.
