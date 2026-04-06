# Localization & Production Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all hardcoded UI strings into Compose Multiplatform string resources for localization, rename "Coach Foska" → "Foska" everywhere in the UI, and fix two production issues: unconditional debug logging and unbounded Koin debug logger.

**Architecture:** Use the existing `composeApp/src/commonMain/composeResources/values/strings.xml` resource file (Compose Multiplatform resource system, already declared as a dependency via `compose.components.resources`). All screens import `Res.string.*` and use `stringResource()`. The `BottomNavTab` enum stores `StringResource` references instead of raw strings.

**Tech Stack:** Compose Multiplatform 1.10.2, `org.jetbrains.compose.resources.stringResource`, BuildKonfig for debug flag.

---

## File Map

**Create:**
- `composeApp/src/commonMain/composeResources/values/strings.xml` — all app string resources

**Modify:**
- `composeApp/src/androidMain/res/values/strings.xml` — update `app_name` to "Foska"
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/auth/WelcomeScreen.kt` — rename + extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/auth/EmailOtpScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/auth/VerifyOtpScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/GoalSelectionScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/BodyStatsScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/ActivityLevelScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/OnboardingCompleteScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/BottomNavBar.kt` — enum refactor + extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/ProfileScreen.kt` — rename "ABOUT COACH FOŠKA" → "ABOUT FOSKA" + extract
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/AboutCoachScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/ProgressScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/LogWorkoutScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealCaptureScreen.kt` — extract strings
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/chat/components/ChatInputBar.kt` — extract strings
- `composeApp/build.gradle.kts` — add `DEBUG` field to BuildKonfig
- `composeApp/src/androidMain/kotlin/com/coachfoska/app/CoachFoskaApplication.kt` — gate Napier + Koin logger behind DEBUG
- `composeApp/src/iosMain/kotlin/com/coachfoska/app/MainViewController.kt` — gate Napier behind DEBUG

---

## Task 1: Create composeResources/values/strings.xml

**Files:**
- Create: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Modify: `composeApp/src/androidMain/res/values/strings.xml`

- [ ] **Step 1: Create the common strings resource file**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- App -->
    <string name="app_name">Foska</string>

    <!-- Auth — WelcomeScreen -->
    <string name="welcome_title">FOSKA</string>
    <string name="welcome_tagline">High performance fitness.\nMinimalist approach.</string>
    <string name="continue_with_email">CONTINUE WITH EMAIL</string>
    <string name="continue_with_google">CONTINUE WITH GOOGLE</string>

    <!-- Auth — EmailOtpScreen -->
    <string name="enter_email_title">ENTER EMAIL</string>
    <string name="enter_email_desc">We\'ll send you a one-time code to sign in to your account.</string>
    <string name="email_address_label">Email address</string>
    <string name="back_cd">Back</string>

    <!-- Auth — VerifyOtpScreen -->
    <string name="verify_code_title">VERIFY CODE</string>
    <string name="verify_otp_desc">Enter the 6-digit code sent to\n%s</string>
    <string name="verification_code_label">Verification code</string>
    <string name="verify_button">VERIFY</string>
    <string name="resend_code">RESEND CODE</string>

    <!-- Shared buttons -->
    <string name="continue_button">CONTINUE</string>

    <!-- Onboarding — GoalSelectionScreen -->
    <string name="onboarding_step_1_of_3">STEP 1 OF 3</string>
    <string name="goal_screen_title">WHAT IS YOUR\nPRIMARY GOAL?</string>
    <string name="goal_screen_desc">This helps us personalize your program.</string>

    <!-- Onboarding — BodyStatsScreen -->
    <string name="onboarding_step_2_of_3">STEP 2 OF 3</string>
    <string name="body_stats_title">TELL US ABOUT\nYOURSELF</string>
    <string name="body_stats_desc">This allows us to calculate your baseline nutrition and training volume accurately.</string>
    <string name="height_label">Height (cm)</string>
    <string name="current_weight_label">Current Weight (kg)</string>
    <string name="age_label">Age</string>

    <!-- Onboarding — ActivityLevelScreen -->
    <string name="onboarding_step_3_of_3">STEP 3 OF 3</string>
    <string name="activity_title">HOW ACTIVE\nARE YOU?</string>
    <string name="activity_desc">Be honest — this sets your calorie baseline and recovery needs.</string>
    <string name="finish_setup">FINISH SETUP</string>

    <!-- Onboarding — OnboardingCompleteScreen -->
    <string name="youre_all_set">YOU\'RE ALL SET!</string>
    <string name="onboarding_complete_desc">Your personalized performance\nprogram is ready for action.</string>
    <string name="summary_goal">GOAL</string>
    <string name="summary_height">HEIGHT</string>
    <string name="summary_weight">WEIGHT</string>
    <string name="summary_activity">ACTIVITY</string>
    <string name="start_training">START TRAINING</string>

    <!-- Home -->
    <string name="welcome_back">WELCOME BACK,</string>
    <string name="default_athlete_name">ATHLETE</string>
    <string name="todays_focus">TODAY\'S FOCUS</string>
    <string name="recovery_day">RECOVERY DAY</string>
    <string name="recovery_day_desc">Focus on mobility and nutrition today.</string>
    <string name="daily_nutrition">DAILY NUTRITION</string>
    <string name="exercises_count">%d EXERCISES</string>
    <string name="duration_min">%d MIN</string>
    <string name="start_logging_meals">Start logging your meals to track progress.</string>
    <string name="macro_kcal">KCAL</string>
    <string name="macro_protein">PRO</string>
    <string name="macro_carbs">CHO</string>
    <string name="macro_fat">FAT</string>
    <string name="coach_label">COACH</string>
    <string name="reply_button">Reply</string>
    <string name="sent_an_image">Sent an image</string>

    <!-- Bottom Nav -->
    <string name="nav_home">Home</string>
    <string name="nav_workout">Workout</string>
    <string name="nav_chat">Chat</string>
    <string name="nav_nutrition">Nutrition</string>
    <string name="nav_profile">Profile</string>

    <!-- Profile -->
    <string name="profile_label">PROFILE</string>
    <string name="stat_goal">GOAL</string>
    <string name="stat_weight">WEIGHT</string>
    <string name="my_progress">MY PROGRESS</string>
    <string name="about_foska">ABOUT FOSKA</string>
    <string name="log_out">LOG OUT</string>

    <!-- Progress -->
    <string name="weight_evolution">WEIGHT EVOLUTION</string>
    <string name="progress_start">START</string>
    <string name="progress_current">CURRENT</string>
    <string name="progress_change">CHANGE</string>
    <string name="body_composition">BODY COMPOSITION</string>
    <string name="stat_height">HEIGHT</string>
    <string name="stat_last_weight">LAST WEIGHT</string>
    <string name="stat_target_goal">TARGET GOAL</string>
    <string name="stat_activity">ACTIVITY</string>
    <string name="weight_kg_format">%skg</string>
    <string name="height_cm_format">%d CM</string>
    <string name="weight_kg_upper_format">%s KG</string>

    <!-- About Coach -->
    <string name="certifications_section">CERTIFICATIONS</string>
    <string name="connect_section">CONNECT</string>
    <string name="instagram_label">INSTAGRAM</string>
    <string name="website_label">WEBSITE</string>

    <!-- Workout -->
    <string name="workout_name_label">Workout Name (e.g. Upper Body A)</string>
    <string name="duration_minutes_label">Duration (minutes)</string>
    <string name="exercises_section">EXERCISES</string>
    <string name="add_exercise">ADD EXERCISE</string>
    <string name="notes_optional">Notes (optional)</string>
    <string name="save_session">SAVE SESSION</string>
    <string name="exercise_label">EXERCISE #%d</string>
    <string name="add_video_cd">Add Video</string>
    <string name="remove_cd">Remove</string>
    <string name="exercise_name_label">Exercise Name</string>
    <string name="sets_label">Sets</string>
    <string name="weight_kg_label">Weight (kg)</string>

    <!-- Nutrition -->
    <string name="meal_name_label">Meal Name (e.g. Breakfast)</string>
    <string name="photo_attached">PHOTO ATTACHED</string>
    <string name="add_meal_photo">ADD MEAL PHOTO</string>
    <string name="food_items_section">FOOD ITEMS</string>
    <string name="add_food">ADD FOOD</string>
    <string name="save_meal">SAVE MEAL</string>
    <string name="food_label">FOOD #%d</string>
    <string name="food_name_label">Food Name</string>
    <string name="kcal_label">kcal</string>
    <string name="protein_label">protein (g)</string>

    <!-- Chat -->
    <string name="attach_image_cd">Attach image</string>
    <string name="message_placeholder">Message...</string>
    <string name="send_cd">Send</string>
</resources>
```

- [ ] **Step 2: Update androidMain strings.xml app_name**

Replace contents of `composeApp/src/androidMain/res/values/strings.xml` with:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Foska</string>
</resources>
```

- [ ] **Step 3: Verify the resources compile**

```bash
./gradlew composeApp:generateComposeResClass --rerun-tasks 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/composeResources/values/strings.xml
git add composeApp/src/androidMain/res/values/strings.xml
git commit -m "feat: add localization string resources, rename app to Foska"
```

---

## Task 2: Update WelcomeScreen — rename + extract strings

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/auth/WelcomeScreen.kt`

- [ ] **Step 1: Replace the imports block and string usages**

Add these imports after the existing imports in WelcomeScreen.kt:
```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 2: Replace the two-Text name block (lines 72–83) with single "FOSKA" Text**

Replace:
```kotlin
                Text(
                    text = "COACH",
                    style = MaterialTheme.typography.displayLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    letterSpacing = 4.sp
                )
                Text(
                    text = "FOŠKA",
                    style = MaterialTheme.typography.displayLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    letterSpacing = 4.sp
                )
```
With:
```kotlin
                Text(
                    text = stringResource(Res.string.welcome_title),
                    style = MaterialTheme.typography.displayLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    letterSpacing = 4.sp
                )
```

- [ ] **Step 3: Extract remaining hardcoded strings**

Replace:
```kotlin
                text = "High performance fitness.\nMinimalist approach.",
```
With:
```kotlin
                text = stringResource(Res.string.welcome_tagline),
```

Replace:
```kotlin
                text = "CONTINUE WITH EMAIL",
```
With:
```kotlin
                text = stringResource(Res.string.continue_with_email),
```

Replace:
```kotlin
                        Text(
                            text = "CONTINUE WITH GOOGLE",
```
With:
```kotlin
                        Text(
                            text = stringResource(Res.string.continue_with_google),
```

- [ ] **Step 4: Verify compilation**

```bash
./gradlew composeApp:compileKotlinAndroid 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/auth/WelcomeScreen.kt
git commit -m "feat: rename app to Foska in WelcomeScreen, extract strings"
```

---

## Task 3: Update EmailOtpScreen and VerifyOtpScreen

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/auth/EmailOtpScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/auth/VerifyOtpScreen.kt`

- [ ] **Step 1: Update EmailOtpScreen imports**

Add after existing imports:
```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 2: Replace all hardcoded strings in EmailOtpScreen**

Replace:
```kotlin
                        contentDescription = "Back"
```
With:
```kotlin
                        contentDescription = stringResource(Res.string.back_cd)
```

Replace:
```kotlin
            Text(
                text = "ENTER EMAIL",
```
With:
```kotlin
            Text(
                text = stringResource(Res.string.enter_email_title),
```

Replace:
```kotlin
            Text(
                text = "We'll send you a one-time code to sign in to your account.",
```
With:
```kotlin
            Text(
                text = stringResource(Res.string.enter_email_desc),
```

Replace:
```kotlin
                label = "Email address",
```
With:
```kotlin
                label = stringResource(Res.string.email_address_label),
```

Replace:
```kotlin
                text = "CONTINUE",
```
With:
```kotlin
                text = stringResource(Res.string.continue_button),
```

- [ ] **Step 3: Update VerifyOtpScreen imports**

Add after existing imports:
```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 4: Replace all hardcoded strings in VerifyOtpScreen**

Replace:
```kotlin
                        contentDescription = "Back"
```
With:
```kotlin
                        contentDescription = stringResource(Res.string.back_cd)
```

Replace:
```kotlin
            Text(
                text = "VERIFY CODE",
```
With:
```kotlin
            Text(
                text = stringResource(Res.string.verify_code_title),
```

Replace:
```kotlin
            Text(
                text = "Enter the 6-digit code sent to\n${state.email}",
```
With:
```kotlin
            Text(
                text = stringResource(Res.string.verify_otp_desc, state.email),
```

Replace:
```kotlin
                label = "Verification code",
```
With:
```kotlin
                label = stringResource(Res.string.verification_code_label),
```

Replace:
```kotlin
                text = "VERIFY",
```
With:
```kotlin
                text = stringResource(Res.string.verify_button),
```

Replace:
```kotlin
                    text = "RESEND CODE",
```
With:
```kotlin
                    text = stringResource(Res.string.resend_code),
```

- [ ] **Step 5: Verify compilation**

```bash
./gradlew composeApp:compileKotlinAndroid 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 6: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/auth/EmailOtpScreen.kt
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/auth/VerifyOtpScreen.kt
git commit -m "feat: extract strings from auth screens"
```

---

## Task 4: Update Onboarding Screens

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/GoalSelectionScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/BodyStatsScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/ActivityLevelScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/OnboardingCompleteScreen.kt`

### GoalSelectionScreen

- [ ] **Step 1: Add imports to GoalSelectionScreen.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 2: Replace hardcoded strings in GoalSelectionScreen**

Replace:
```kotlin
                title = { Text("STEP 1 OF 3", style = MaterialTheme.typography.labelSmall, letterSpacing = 2.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)) },
```
With:
```kotlin
                title = { Text(stringResource(Res.string.onboarding_step_1_of_3), style = MaterialTheme.typography.labelSmall, letterSpacing = 2.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)) },
```

Replace:
```kotlin
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
```
With:
```kotlin
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(Res.string.back_cd))
```

Replace:
```kotlin
                    text = "WHAT IS YOUR\nPRIMARY GOAL?",
```
With:
```kotlin
                    text = stringResource(Res.string.goal_screen_title),
```

Replace:
```kotlin
                    text = "This helps us personalize your program.",
```
With:
```kotlin
                    text = stringResource(Res.string.goal_screen_desc),
```

Replace (in `CoachButton`):
```kotlin
                text = "CONTINUE",
```
With:
```kotlin
                text = stringResource(Res.string.continue_button),
```

### BodyStatsScreen

- [ ] **Step 3: Add imports to BodyStatsScreen.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 4: Replace hardcoded strings in BodyStatsScreen**

Replace:
```kotlin
                title = { Text("STEP 2 OF 3", style = MaterialTheme.typography.labelSmall, letterSpacing = 2.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)) },
```
With:
```kotlin
                title = { Text(stringResource(Res.string.onboarding_step_2_of_3), style = MaterialTheme.typography.labelSmall, letterSpacing = 2.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)) },
```

Replace:
```kotlin
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
```
With:
```kotlin
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(Res.string.back_cd))
```

Replace:
```kotlin
                    text = "TELL US ABOUT\nYOURSELF",
```
With:
```kotlin
                    text = stringResource(Res.string.body_stats_title),
```

Replace:
```kotlin
                    text = "This allows us to calculate your baseline nutrition and training volume accurately.",
```
With:
```kotlin
                    text = stringResource(Res.string.body_stats_desc),
```

Replace:
```kotlin
                        label = "Height (cm)",
```
With:
```kotlin
                        label = stringResource(Res.string.height_label),
```

Replace:
```kotlin
                        label = "Current Weight (kg)",
```
With:
```kotlin
                        label = stringResource(Res.string.current_weight_label),
```

Replace:
```kotlin
                        label = "Age",
```
With:
```kotlin
                        label = stringResource(Res.string.age_label),
```

Replace:
```kotlin
                text = "CONTINUE",
```
With:
```kotlin
                text = stringResource(Res.string.continue_button),
```

### ActivityLevelScreen

- [ ] **Step 5: Add imports to ActivityLevelScreen.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 6: Replace hardcoded strings in ActivityLevelScreen**

Replace:
```kotlin
                title = { Text("STEP 3 OF 3", style = MaterialTheme.typography.labelSmall, letterSpacing = 2.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)) },
```
With:
```kotlin
                title = { Text(stringResource(Res.string.onboarding_step_3_of_3), style = MaterialTheme.typography.labelSmall, letterSpacing = 2.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)) },
```

Replace:
```kotlin
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
```
With:
```kotlin
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(Res.string.back_cd))
```

Replace:
```kotlin
                    text = "HOW ACTIVE\nARE YOU?",
```
With:
```kotlin
                    text = stringResource(Res.string.activity_title),
```

Replace:
```kotlin
                    text = "Be honest — this sets your calorie baseline and recovery needs.",
```
With:
```kotlin
                    text = stringResource(Res.string.activity_desc),
```

Replace:
```kotlin
                text = "FINISH SETUP",
```
With:
```kotlin
                text = stringResource(Res.string.finish_setup),
```

### OnboardingCompleteScreen

- [ ] **Step 7: Add imports to OnboardingCompleteScreen.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 8: Replace hardcoded strings in OnboardingCompleteScreen**

Replace:
```kotlin
                    text = "YOU'RE ALL SET!",
```
With:
```kotlin
                    text = stringResource(Res.string.youre_all_set),
```

Replace:
```kotlin
                    text = "Your personalized performance\nprogram is ready for action.",
```
With:
```kotlin
                    text = stringResource(Res.string.onboarding_complete_desc),
```

Replace:
```kotlin
                    state.selectedGoal?.let { SummaryRow(label = "GOAL", value = it.displayName.uppercase()) }
                    if (state.heightInput.isNotBlank()) SummaryRow(label = "HEIGHT", value = "${state.heightInput} CM")
                    if (state.weightInput.isNotBlank()) SummaryRow(label = "WEIGHT", value = "${state.weightInput} KG")
                    state.selectedActivityLevel?.let { SummaryRow(label = "ACTIVITY", value = it.displayName.uppercase()) }
```
With:
```kotlin
                    state.selectedGoal?.let { SummaryRow(label = stringResource(Res.string.summary_goal), value = it.displayName.uppercase()) }
                    if (state.heightInput.isNotBlank()) SummaryRow(label = stringResource(Res.string.summary_height), value = stringResource(Res.string.height_cm_format, state.heightInput.toIntOrNull() ?: 0))
                    if (state.weightInput.isNotBlank()) SummaryRow(label = stringResource(Res.string.summary_weight), value = stringResource(Res.string.weight_kg_upper_format, state.weightInput))
                    state.selectedActivityLevel?.let { SummaryRow(label = stringResource(Res.string.summary_activity), value = it.displayName.uppercase()) }
```

Replace:
```kotlin
                text = "START TRAINING",
```
With:
```kotlin
                text = stringResource(Res.string.start_training),
```

- [ ] **Step 9: Verify compilation**

```bash
./gradlew composeApp:compileKotlinAndroid 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 10: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/
git commit -m "feat: extract strings from all onboarding screens"
```

---

## Task 5: Update HomeScreen

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt`

- [ ] **Step 1: Add imports**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 2: Replace hardcoded strings**

Replace:
```kotlin
                    text = "WELCOME BACK,",
```
With:
```kotlin
                    text = stringResource(Res.string.welcome_back),
```

Replace:
```kotlin
                    text = (state.user?.fullName?.split(" ")?.firstOrNull() ?: "ATHLETE").uppercase(),
```
With:
```kotlin
                    text = (state.user?.fullName?.split(" ")?.firstOrNull() ?: stringResource(Res.string.default_athlete_name)).uppercase(),
```

Replace:
```kotlin
                    text = "TODAY'S FOCUS",
```
With:
```kotlin
                    text = stringResource(Res.string.todays_focus),
```

Replace:
```kotlin
                            text = "RECOVERY DAY",
```
With:
```kotlin
                            text = stringResource(Res.string.recovery_day),
```

Replace:
```kotlin
                            text = "Focus on mobility and nutrition today.",
```
With:
```kotlin
                            text = stringResource(Res.string.recovery_day_desc),
```

Replace:
```kotlin
                    text = "DAILY NUTRITION",
```
With:
```kotlin
                    text = stringResource(Res.string.daily_nutrition),
```

Replace:
```kotlin
                        text = "Start logging your meals to track progress.",
```
With:
```kotlin
                        text = stringResource(Res.string.start_logging_meals),
```

Replace (in `WorkoutHomeCard`):
```kotlin
                    text = "${workout.exercises.size} EXERCISES",
```
With:
```kotlin
                    text = stringResource(Res.string.exercises_count, workout.exercises.size),
```

Replace (in `WorkoutHomeCard`):
```kotlin
                    text = "${workout.durationMinutes} MIN",
```
With:
```kotlin
                    text = stringResource(Res.string.duration_min, workout.durationMinutes),
```

Replace (in `MacroRow`):
```kotlin
        MacroItem(label = "KCAL", value = "${summary.calories.toInt()}")
        MacroItem(label = "PRO", value = "${summary.proteinG.toInt()}g")
        MacroItem(label = "CHO", value = "${summary.carbsG.toInt()}g")
        MacroItem(label = "FAT", value = "${summary.fatG.toInt()}g")
```
With:
```kotlin
        MacroItem(label = stringResource(Res.string.macro_kcal), value = "${summary.calories.toInt()}")
        MacroItem(label = stringResource(Res.string.macro_protein), value = "${summary.proteinG.toInt()}g")
        MacroItem(label = stringResource(Res.string.macro_carbs), value = "${summary.carbsG.toInt()}g")
        MacroItem(label = stringResource(Res.string.macro_fat), value = "${summary.fatG.toInt()}g")
```

Replace (in `CoachMessagePreviewCard`):
```kotlin
                    text = "COACH",
```
With:
```kotlin
                    text = stringResource(Res.string.coach_label),
```

Replace (in `CoachMessagePreviewCard`):
```kotlin
                        is MessageContent.Image -> "Sent an image"
```
With:
```kotlin
                        is MessageContent.Image -> stringResource(Res.string.sent_an_image)
```

Replace (in `CoachMessagePreviewCard`):
```kotlin
                text = "Reply",
```
With:
```kotlin
                text = stringResource(Res.string.reply_button),
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew composeApp:compileKotlinAndroid 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt
git commit -m "feat: extract strings from HomeScreen"
```

---

## Task 6: Refactor BottomNavBar enum for localization

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/BottomNavBar.kt`

The `label: String` field in the enum must become `labelRes: StringResource` so localized strings are resolved at composable call time, not at enum init.

- [ ] **Step 1: Replace the full BottomNavBar.kt file**

```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource

enum class BottomNavTab(val labelRes: StringResource, val icon: ImageVector) {
    Home(Res.string.nav_home, Icons.Default.Home),
    Workout(Res.string.nav_workout, Icons.Default.FitnessCenter),
    Chat(Res.string.nav_chat, Icons.AutoMirrored.Filled.Chat),
    Nutrition(Res.string.nav_nutrition, Icons.Default.Restaurant),
    Profile(Res.string.nav_profile, Icons.Default.Person)
}

@Composable
fun BottomNavBar(
    selectedTab: BottomNavTab,
    onTabSelected: (BottomNavTab) -> Unit,
    chatUnreadCount: Int = 0
) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.background,
        tonalElevation = 0.dp
    ) {
        BottomNavTab.entries.forEach { tab ->
            val label = stringResource(tab.labelRes)
            NavigationBarItem(
                selected = selectedTab == tab,
                onClick = { onTabSelected(tab) },
                icon = {
                    if (tab == BottomNavTab.Chat && chatUnreadCount > 0) {
                        BadgedBox(
                            badge = { Badge { Text(chatUnreadCount.coerceAtMost(99).toString()) } }
                        ) {
                            Icon(tab.icon, contentDescription = label)
                        }
                    } else {
                        Icon(tab.icon, contentDescription = label)
                    }
                },
                label = {
                    Text(label, style = MaterialTheme.typography.labelSmall)
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
                )
            )
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew composeApp:compileKotlinAndroid 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/BottomNavBar.kt
git commit -m "feat: refactor BottomNavBar enum to use StringResource for localization"
```

---

## Task 7: Update ProfileScreen, ProgressScreen, and AboutCoachScreen

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/ProfileScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/ProgressScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/AboutCoachScreen.kt`

### ProfileScreen

- [ ] **Step 1: Add imports to ProfileScreen.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 2: Replace hardcoded strings in ProfileScreen**

Replace:
```kotlin
                    text = "PROFILE",
```
With:
```kotlin
                    text = stringResource(Res.string.profile_label),
```

Replace:
```kotlin
                    text = (state.user?.fullName ?: "ATHLETE").uppercase(),
```
With:
```kotlin
                    text = (state.user?.fullName ?: stringResource(Res.string.default_athlete_name)).uppercase(),
```

Replace:
```kotlin
                    ProfileStatCard(
                        label = "GOAL",
```
With:
```kotlin
                    ProfileStatCard(
                        label = stringResource(Res.string.stat_goal),
```

Replace:
```kotlin
                    ProfileStatCard(
                        label = "WEIGHT",
                        value = "${user.weightKg ?: "--"} KG",
```
With:
```kotlin
                    ProfileStatCard(
                        label = stringResource(Res.string.stat_weight),
                        value = stringResource(Res.string.weight_kg_upper_format, user.weightKg?.toString() ?: "--"),
```

Replace:
```kotlin
                ProfileMenuItem(label = "MY PROGRESS", onClick = onProgressClick)
```
With:
```kotlin
                ProfileMenuItem(label = stringResource(Res.string.my_progress), onClick = onProgressClick)
```

Replace:
```kotlin
                ProfileMenuItem(label = "ABOUT COACH FOŠKA", onClick = onAboutCoachClick)
```
With:
```kotlin
                ProfileMenuItem(label = stringResource(Res.string.about_foska), onClick = onAboutCoachClick)
```

Replace:
```kotlin
                    text = "LOG OUT",
```
With:
```kotlin
                    text = stringResource(Res.string.log_out),
```

### ProgressScreen

- [ ] **Step 3: Add imports to ProgressScreen.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 4: Replace hardcoded strings in ProgressScreen**

Replace:
```kotlin
                        Text(
                            text = "WEIGHT EVOLUTION",
```
With:
```kotlin
                        Text(
                            text = stringResource(Res.string.weight_evolution),
```

Replace:
```kotlin
                                        Column {
                                            Text("START", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
                                            Text("${first}kg", style = MaterialTheme.typography.titleMedium)
                                        }
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text("CURRENT", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
                                            Text("${last}kg", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text("CHANGE", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
                                            Text(
                                                text = "${if (diff < 0) "" else "+"}${(kotlin.math.round(diff * 10) / 10.0)}kg",
```
With:
```kotlin
                                        Column {
                                            Text(stringResource(Res.string.progress_start), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
                                            Text(stringResource(Res.string.weight_kg_format, first), style = MaterialTheme.typography.titleMedium)
                                        }
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text(stringResource(Res.string.progress_current), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
                                            Text(stringResource(Res.string.weight_kg_format, last), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(stringResource(Res.string.progress_change), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
                                            Text(
                                                text = "${if (diff < 0) "" else "+"}${stringResource(Res.string.weight_kg_format, kotlin.math.round(diff * 10) / 10.0)}",
```

Replace:
```kotlin
                        Text(
                            text = "BODY COMPOSITION",
```
With:
```kotlin
                        Text(
                            text = stringResource(Res.string.body_composition),
```

Replace:
```kotlin
                                user.heightCm?.let { ProgressStatRow("HEIGHT", "${it.toInt()} CM") }
```
With:
```kotlin
                                user.heightCm?.let { ProgressStatRow(stringResource(Res.string.stat_height), stringResource(Res.string.height_cm_format, it.toInt())) }
```

Replace:
```kotlin
                                user.weightKg?.let { ProgressStatRow("LAST WEIGHT", "${it} KG") }
```
With:
```kotlin
                                user.weightKg?.let { ProgressStatRow(stringResource(Res.string.stat_last_weight), stringResource(Res.string.weight_kg_upper_format, it.toString())) }
```

Replace:
```kotlin
                                user.goal?.let { ProgressStatRow("TARGET GOAL", it.displayName.uppercase()) }
```
With:
```kotlin
                                user.goal?.let { ProgressStatRow(stringResource(Res.string.stat_target_goal), it.displayName.uppercase()) }
```

Replace:
```kotlin
                                user.activityLevel?.let { ProgressStatRow("ACTIVITY", it.displayName.uppercase()) }
```
With:
```kotlin
                                user.activityLevel?.let { ProgressStatRow(stringResource(Res.string.stat_activity), it.displayName.uppercase()) }
```

### AboutCoachScreen

- [ ] **Step 5: Add imports to AboutCoachScreen.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 6: Replace hardcoded section header strings in AboutCoachScreen**

Replace:
```kotlin
                    Text(
                        text = "CERTIFICATIONS",
```
With:
```kotlin
                    Text(
                        text = stringResource(Res.string.certifications_section),
```

Replace:
```kotlin
                    Text(
                        text = "CONNECT",
```
With:
```kotlin
                    Text(
                        text = stringResource(Res.string.connect_section),
```

Replace in `ConnectRow` calls:
```kotlin
                            ConnectRow("INSTAGRAM", instagram)
```
With:
```kotlin
                            ConnectRow(stringResource(Res.string.instagram_label), instagram)
```

Replace:
```kotlin
                            ConnectRow("WEBSITE", website)
```
With:
```kotlin
                            ConnectRow(stringResource(Res.string.website_label), website)
```

- [ ] **Step 7: Verify compilation**

```bash
./gradlew composeApp:compileKotlinAndroid 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 8: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/
git commit -m "feat: extract strings from profile screens, rename About Coach Foska to About Foska"
```

---

## Task 8: Update LogWorkoutScreen and MealCaptureScreen

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/LogWorkoutScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealCaptureScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/chat/components/ChatInputBar.kt`

### LogWorkoutScreen

- [ ] **Step 1: Add imports to LogWorkoutScreen.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 2: Replace hardcoded strings in LogWorkoutScreen**

Replace:
```kotlin
                label = "Workout Name (e.g. Upper Body A)"
```
With:
```kotlin
                label = stringResource(Res.string.workout_name_label)
```

Replace:
```kotlin
                label = "Duration (minutes)",
```
With:
```kotlin
                label = stringResource(Res.string.duration_minutes_label),
```

Replace:
```kotlin
        CoachSectionHeader(text = "EXERCISES")
```
With:
```kotlin
        CoachSectionHeader(text = stringResource(Res.string.exercises_section))
```

Replace:
```kotlin
            Text("ADD EXERCISE", style = MaterialTheme.typography.labelLarge)
```
With:
```kotlin
            Text(stringResource(Res.string.add_exercise), style = MaterialTheme.typography.labelLarge)
```

Replace:
```kotlin
                label = "Notes (optional)",
```
With:
```kotlin
                label = stringResource(Res.string.notes_optional),
```

Replace:
```kotlin
                text = "SAVE SESSION",
```
With:
```kotlin
                text = stringResource(Res.string.save_session),
```

Replace (in `ExerciseLogRow`):
```kotlin
                    text = "EXERCISE #$index",
```
With:
```kotlin
                    text = stringResource(Res.string.exercise_label, index),
```

Replace:
```kotlin
                            contentDescription = "Add Video",
```
With:
```kotlin
                            contentDescription = stringResource(Res.string.add_video_cd),
```

Replace:
```kotlin
                            contentDescription = "Remove",
```
With:
```kotlin
                            contentDescription = stringResource(Res.string.remove_cd),
```

Replace:
```kotlin
                label = "Exercise Name"
```
With:
```kotlin
                label = stringResource(Res.string.exercise_name_label)
```

Replace:
```kotlin
                    label = "Sets",
```
With:
```kotlin
                    label = stringResource(Res.string.sets_label),
```

Replace:
```kotlin
                    label = "Weight (kg)",
```
With:
```kotlin
                    label = stringResource(Res.string.weight_kg_label),
```

### MealCaptureScreen

- [ ] **Step 3: Add imports to MealCaptureScreen.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 4: Replace hardcoded strings in MealCaptureScreen**

Replace:
```kotlin
                label = "Meal Name (e.g. Breakfast)"
```
With:
```kotlin
                label = stringResource(Res.string.meal_name_label)
```

Replace:
```kotlin
                    text = if (mediaUri != null) "PHOTO ATTACHED" else "ADD MEAL PHOTO",
```
With:
```kotlin
                    text = if (mediaUri != null) stringResource(Res.string.photo_attached) else stringResource(Res.string.add_meal_photo),
```

Replace:
```kotlin
        CoachSectionHeader(text = "FOOD ITEMS")
```
With:
```kotlin
        CoachSectionHeader(text = stringResource(Res.string.food_items_section))
```

Replace:
```kotlin
                Text("ADD FOOD", style = MaterialTheme.typography.labelLarge)
```
With:
```kotlin
                Text(stringResource(Res.string.add_food), style = MaterialTheme.typography.labelLarge)
```

Replace:
```kotlin
                label = "Notes (optional)",
```
With:
```kotlin
                label = stringResource(Res.string.notes_optional),
```

Replace:
```kotlin
                text = "SAVE MEAL",
```
With:
```kotlin
                text = stringResource(Res.string.save_meal),
```

Replace (in `FoodEntryRow`):
```kotlin
                    text = "FOOD #$index",
```
With:
```kotlin
                    text = stringResource(Res.string.food_label, index),
```

Replace:
```kotlin
                            contentDescription = "Remove",
```
With:
```kotlin
                            contentDescription = stringResource(Res.string.remove_cd),
```

Replace:
```kotlin
                label = "Food Name"
```
With:
```kotlin
                label = stringResource(Res.string.food_name_label)
```

Replace:
```kotlin
                    label = "kcal",
```
With:
```kotlin
                    label = stringResource(Res.string.kcal_label),
```

Replace:
```kotlin
                    label = "protein (g)",
```
With:
```kotlin
                    label = stringResource(Res.string.protein_label),
```

### ChatInputBar

- [ ] **Step 5: Add imports to ChatInputBar.kt**

```kotlin
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
```

- [ ] **Step 6: Replace hardcoded strings in ChatInputBar**

Replace:
```kotlin
                contentDescription = "Attach image",
```
With:
```kotlin
                contentDescription = stringResource(Res.string.attach_image_cd),
```

Replace:
```kotlin
            placeholder = { Text("Message...", style = MaterialTheme.typography.bodyMedium) },
```
With:
```kotlin
            placeholder = { Text(stringResource(Res.string.message_placeholder), style = MaterialTheme.typography.bodyMedium) },
```

Replace:
```kotlin
                    contentDescription = "Send",
```
With:
```kotlin
                    contentDescription = stringResource(Res.string.send_cd),
```

- [ ] **Step 7: Verify compilation**

```bash
./gradlew composeApp:compileKotlinAndroid 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 8: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/LogWorkoutScreen.kt
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealCaptureScreen.kt
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/chat/components/ChatInputBar.kt
git commit -m "feat: extract strings from workout, nutrition, and chat screens"
```

---

## Task 9: Fix production logging — gate DebugAntilog and Koin logger behind DEBUG flag

**Problem:** `DebugAntilog()` is initialized unconditionally in both `CoachFoskaApplication.kt` and `MainViewController.kt`, meaning verbose logs (including user IDs and health data) are emitted in production release builds. Koin is also configured with `Level.DEBUG` unconditionally on Android.

**Fix:**
1. Add a `DEBUG` boolean to BuildKonfig (set from `local.properties`, defaulting to `false`)  
2. Gate `Napier.base(DebugAntilog())` behind `BuildKonfig.DEBUG` on both platforms
3. Gate Koin's `androidLogger(Level.DEBUG)` behind `BuildKonfig.DEBUG`

**Files:**
- Modify: `composeApp/build.gradle.kts`
- Modify: `composeApp/src/androidMain/kotlin/com/coachfoska/app/CoachFoskaApplication.kt`
- Modify: `composeApp/src/iosMain/kotlin/com/coachfoska/app/MainViewController.kt`

- [ ] **Step 1: Add DEBUG field to BuildKonfig in build.gradle.kts**

In the `defaultConfigs` block of `buildkonfig { ... }`, after the existing fields, add:
```kotlin
        buildConfigField(
            BOOLEAN, "DEBUG",
            localProperties.getProperty("debug") ?: "false"
        )
```

Full updated `defaultConfigs` block:
```kotlin
    defaultConfigs {
        buildConfigField(
            STRING, "SUPABASE_URL",
            localProperties.getProperty("supabase.url") ?: ""
        )
        buildConfigField(
            STRING, "SUPABASE_ANON_KEY",
            localProperties.getProperty("supabase.anon.key") ?: ""
        )
        buildConfigField(
            STRING, "GOOGLE_WEB_CLIENT_ID",
            localProperties.getProperty("google.web.client.id") ?: ""
        )
        buildConfigField(
            STRING, "ANTHROPIC_API_KEY",
            localProperties.getProperty("anthropic.api.key") ?: ""
        )
        buildConfigField(
            BOOLEAN, "AI_COACH_ENABLED",
            localProperties.getProperty("ai.coach.enabled") ?: "false"
        )
        buildConfigField(
            STRING, "AI_COACH_SYSTEM_PROMPT",
            localProperties.getProperty("ai.coach.system.prompt")
                ?: "You are a professional fitness and nutrition coach. Provide helpful, evidence-based advice on workouts, nutrition, and healthy habits. Be encouraging, concise, and personalized."
        )
        buildConfigField(
            BOOLEAN, "DEBUG",
            localProperties.getProperty("debug") ?: "false"
        )
    }
```

To enable logging locally, add `debug=true` to `local.properties`. This key is already gitignored.

- [ ] **Step 2: Update CoachFoskaApplication.kt**

Replace:
```kotlin
        Napier.base(DebugAntilog())
        startKoin {
            androidLogger(Level.DEBUG)
            androidContext(this@CoachFoskaApplication)
            modules(appModules + androidModule)
        }
```
With:
```kotlin
        if (BuildKonfig.DEBUG) {
            Napier.base(DebugAntilog())
        }
        startKoin {
            if (BuildKonfig.DEBUG) {
                androidLogger(Level.DEBUG)
            }
            androidContext(this@CoachFoskaApplication)
            modules(appModules + androidModule)
        }
```

Also add import if not present:
```kotlin
import com.coachfoska.app.BuildKonfig
```

- [ ] **Step 3: Update MainViewController.kt (iOS)**

Replace:
```kotlin
fun initKoin() {
    Napier.base(DebugAntilog())
    startKoin {
        modules(appModules + iosModule)
    }
}
```
With:
```kotlin
fun initKoin() {
    if (BuildKonfig.DEBUG) {
        Napier.base(DebugAntilog())
    }
    startKoin {
        modules(appModules + iosModule)
    }
}
```

Also add import if not present:
```kotlin
import com.coachfoska.app.BuildKonfig
```

- [ ] **Step 4: Verify compilation**

```bash
./gradlew composeApp:compileKotlinAndroid 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add composeApp/build.gradle.kts
git add composeApp/src/androidMain/kotlin/com/coachfoska/app/CoachFoskaApplication.kt
git add composeApp/src/iosMain/kotlin/com/coachfoska/app/MainViewController.kt
git commit -m "fix: gate Napier debug logging and Koin debug logger behind BuildKonfig.DEBUG"
```

---

## Self-Review Against Spec

**Spec requirements:**
1. ✅ Rename "Coach Foska" → "Foska" — WelcomeScreen (`welcome_title = "FOSKA"`), ProfileScreen (`about_foska = "ABOUT FOSKA"`), androidMain `strings.xml` (`app_name = "Foska"`)
2. ✅ Extract all strings for localization — all 15+ screen files covered, 80+ string keys in `strings.xml`
3. ✅ Find and fix other production issues:
   - ✅ Unconditional `DebugAntilog` logging (Task 9)
   - ✅ Unconditional Koin `Level.DEBUG` logger (Task 9)
   - ℹ️ Apple Sign-In throws `NotImplementedError` — **not blocked**: the WelcomeScreen only shows Email + Google buttons, no Apple Sign-In button is rendered to users. The implementation stub is safe as-is.

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references found.

**Type consistency:** `StringResource` used throughout, `stringResource()` call signature is consistent.
