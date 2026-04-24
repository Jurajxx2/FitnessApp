# Water Tracking & Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add daily water intake tracking with a Home progress bar, a Nutrition Hub card, a full HydrationScreen, and configurable local-notification reminders backed by Supabase.

**Architecture:** Clean Architecture with a new `hydrationModule` in Koin. Data flows through `HydrationRemoteDataSource` → `HydrationRepositoryImpl` → use-cases → `HydrationViewModel`. Reminders are delivered via a `WaterReminderScheduler` interface (WorkManager on Android, `UNUserNotificationCenter` on iOS) wired through the existing `androidModule`/`iosModule` platform split.

**Tech Stack:** Supabase Postgrest, Koin 4.1.1, WorkManager (new dependency), Compose Multiplatform, MockK, kotlinx-datetime, kotlinx-coroutines-test.

---

## File Map

**New files:**
- `supabase/migrations/20260424000000_add_water_tracking.sql`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Hydration.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/HydrationRepository.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/hydration/CalculateWaterGoalUseCase.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/hydration/WaterReminderScheduler.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/HydrationDto.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/HydrationRemoteDataSource.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/HydrationRepositoryImpl.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationState.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationIntent.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationViewModel.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/hydration/HydrationScreen.kt`
- `composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/AndroidWaterReminderScheduler.kt`
- `composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/HydrationWorker.kt`
- `composeApp/src/iosMain/kotlin/com/coachfoska/app/hydration/IosWaterReminderScheduler.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/hydration/CalculateWaterGoalUseCaseTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/hydration/HydrationViewModelTest.kt`

**Modified files:**
- `gradle/libs.versions.toml` — add WorkManager version + library alias
- `composeApp/build.gradle.kts` — add WorkManager to `androidMain.dependencies`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` — add `hydrationModule`, update `appModules`, update `viewModelModule` for HomeViewModel
- `composeApp/src/androidMain/kotlin/com/coachfoska/app/di/AndroidModule.kt` — bind `AndroidWaterReminderScheduler`
- `composeApp/src/iosMain/kotlin/com/coachfoska/app/di/IosModule.kt` — bind `IosWaterReminderScheduler`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt` — add `Hydration` route
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt` — add `Hydration` composable, add `onWaterClick` to `NutritionHubRoute`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt` — add Water card, `onWaterClick` param
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeState.kt` — add `waterConsumedMl`, `waterGoalMl`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt` — fetch water data, add `HydrationRepository` + `CalculateWaterGoalUseCase` deps
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt` — add water progress bar to nutrition card

---

## Task 1: DB Migrations

**Files:**
- Create: `supabase/migrations/20260424000000_add_water_tracking.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260424000000_add_water_tracking.sql

CREATE TABLE water_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_ml   INTEGER NOT NULL,
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own water logs"
    ON water_logs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_water_logs_user_date ON water_logs(user_id, logged_at DESC);

-- ─────────────────────────────────────────────────────────────

CREATE TABLE hydration_settings (
    user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    interval_minutes  INTEGER NOT NULL DEFAULT 120,
    start_hour        INTEGER NOT NULL DEFAULT 7,
    end_hour          INTEGER NOT NULL DEFAULT 22,
    smart_suppress    BOOLEAN NOT NULL DEFAULT TRUE,
    reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hydration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own hydration settings"
    ON hydration_settings FOR ALL USING (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
supabase db push
```

Expected: migration applied without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260424000000_add_water_tracking.sql
git commit -m "feat(db): add water_logs and hydration_settings tables"
```

---

## Task 2: Domain Models

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Hydration.kt`

- [ ] **Step 1: Create the domain models**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Hydration.kt
package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant

data class WaterLog(
    val id: String,
    val amountMl: Int,
    val loggedAt: Instant
)

data class HydrationSettings(
    val intervalMinutes: Int = 120,
    val startHour: Int = 7,
    val endHour: Int = 22,
    val smartSuppress: Boolean = true,
    val remindersEnabled: Boolean = true
)
```

- [ ] **Step 2: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Hydration.kt
git commit -m "feat(domain): add WaterLog and HydrationSettings models"
```

---

## Task 3: HydrationRepository Interface + CalculateWaterGoalUseCase + Tests

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/HydrationRepository.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/hydration/CalculateWaterGoalUseCase.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/hydration/CalculateWaterGoalUseCaseTest.kt`

- [ ] **Step 1: Write the failing tests**

```kotlin
// composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/hydration/CalculateWaterGoalUseCaseTest.kt
package com.coachfoska.app.domain.usecase.hydration

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import kotlin.test.Test
import kotlin.test.assertEquals

class CalculateWaterGoalUseCaseTest {

    private val useCase = CalculateWaterGoalUseCase()

    private fun user(weightKg: Float?, activityLevel: ActivityLevel?) = User(
        id = "u1", email = "a@b.com", fullName = null,
        age = null, heightCm = null,
        weightKg = weightKg, goal = UserGoal.MUSCLE_GAIN,
        activityLevel = activityLevel
    )

    @Test
    fun `sedentary 80kg returns 2800ml`() {
        assertEquals(2800, useCase(user(80f, ActivityLevel.SEDENTARY)))
    }

    @Test
    fun `active 70kg returns 3185ml`() {
        assertEquals(3185, useCase(user(70f, ActivityLevel.ACTIVE)))
    }

    @Test
    fun `very active 90kg returns 4410ml`() {
        assertEquals(4410, useCase(user(90f, ActivityLevel.VERY_ACTIVE)))
    }

    @Test
    fun `null weight falls back to 2000ml`() {
        assertEquals(2000, useCase(user(null, ActivityLevel.ACTIVE)))
    }

    @Test
    fun `null activity level falls back to 2000ml`() {
        assertEquals(2000, useCase(user(70f, null)))
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCaseTest" 2>&1 | tail -20
```

Expected: compilation error — `CalculateWaterGoalUseCase` not found.

- [ ] **Step 3: Create HydrationRepository interface**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/HydrationRepository.kt
package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog

interface HydrationRepository {
    suspend fun logWater(userId: String, amountMl: Int): Result<WaterLog>
    suspend fun getTodayLogs(userId: String): Result<List<WaterLog>>
    suspend fun deleteLog(userId: String, logId: String): Result<Unit>
    suspend fun getSettings(userId: String): Result<HydrationSettings>
    suspend fun saveSettings(userId: String, settings: HydrationSettings): Result<Unit>
}
```

- [ ] **Step 4: Implement CalculateWaterGoalUseCase**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/hydration/CalculateWaterGoalUseCase.kt
package com.coachfoska.app.domain.usecase.hydration

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.User

class CalculateWaterGoalUseCase {
    operator fun invoke(user: User): Int {
        val weight = user.weightKg ?: return 2000
        val level = user.activityLevel ?: return 2000
        val multiplier = when (level) {
            ActivityLevel.SEDENTARY -> 1.0
            ActivityLevel.LIGHTLY_ACTIVE -> 1.1
            ActivityLevel.MODERATELY_ACTIVE -> 1.2
            ActivityLevel.ACTIVE -> 1.3
            ActivityLevel.VERY_ACTIVE -> 1.4
        }
        return (weight * 35 * multiplier).toInt()
    }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCaseTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/HydrationRepository.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/hydration/CalculateWaterGoalUseCase.kt \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/hydration/CalculateWaterGoalUseCaseTest.kt
git commit -m "feat(domain): add HydrationRepository interface and CalculateWaterGoalUseCase"
```

---

## Task 4: DTOs

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/HydrationDto.kt`

- [ ] **Step 1: Create the DTOs**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/HydrationDto.kt
package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog
import kotlinx.datetime.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class WaterLogDto(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("amount_ml") val amountMl: Int,
    @SerialName("logged_at") val loggedAt: String
) {
    fun toDomain(): WaterLog = WaterLog(
        id = id,
        amountMl = amountMl,
        loggedAt = Instant.parse(loggedAt)
    )
}

@Serializable
data class WaterLogInsertDto(
    @SerialName("user_id") val userId: String,
    @SerialName("amount_ml") val amountMl: Int,
    @SerialName("logged_at") val loggedAt: String
)

@Serializable
data class HydrationSettingsDto(
    @SerialName("user_id") val userId: String,
    @SerialName("interval_minutes") val intervalMinutes: Int = 120,
    @SerialName("start_hour") val startHour: Int = 7,
    @SerialName("end_hour") val endHour: Int = 22,
    @SerialName("smart_suppress") val smartSuppress: Boolean = true,
    @SerialName("reminders_enabled") val remindersEnabled: Boolean = true
) {
    fun toDomain(): HydrationSettings = HydrationSettings(
        intervalMinutes = intervalMinutes,
        startHour = startHour,
        endHour = endHour,
        smartSuppress = smartSuppress,
        remindersEnabled = remindersEnabled
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/HydrationDto.kt
git commit -m "feat(data): add hydration DTOs"
```

---

## Task 5: HydrationRemoteDataSource

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/HydrationRemoteDataSource.kt`

- [ ] **Step 1: Implement the data source**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/HydrationRemoteDataSource.kt
package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.data.remote.dto.HydrationSettingsDto
import com.coachfoska.app.data.remote.dto.WaterLogDto
import com.coachfoska.app.data.remote.dto.WaterLogInsertDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.plus

class HydrationRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun insertWaterLog(userId: String, amountMl: Int): WaterLogDto {
        val payload = WaterLogInsertDto(
            userId = userId,
            amountMl = amountMl,
            loggedAt = currentInstant().toString()
        )
        return supabase.postgrest["water_logs"]
            .insert(payload) { select() }
            .decodeSingle<WaterLogDto>()
    }

    suspend fun getTodayLogs(userId: String): List<WaterLogDto> {
        val today = todayDate()
        val tomorrow = today.plus(1, DateTimeUnit.DAY)
        return supabase.postgrest["water_logs"]
            .select {
                filter {
                    eq("user_id", userId)
                    gte("logged_at", "${today}T00:00:00Z")
                    lt("logged_at", "${tomorrow}T00:00:00Z")
                }
                order("logged_at", Order.DESCENDING)
            }
            .decodeList<WaterLogDto>()
    }

    suspend fun deleteLog(logId: String) {
        supabase.postgrest["water_logs"]
            .delete { filter { eq("id", logId) } }
    }

    suspend fun getSettings(userId: String): HydrationSettingsDto? =
        supabase.postgrest["hydration_settings"]
            .select { filter { eq("user_id", userId) } }
            .decodeList<HydrationSettingsDto>()
            .firstOrNull()

    suspend fun upsertSettings(dto: HydrationSettingsDto) {
        supabase.postgrest["hydration_settings"]
            .upsert(dto) { onConflict = "user_id" }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/HydrationRemoteDataSource.kt
git commit -m "feat(data): add HydrationRemoteDataSource"
```

---

## Task 6: HydrationRepositoryImpl

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/HydrationRepositoryImpl.kt`

- [ ] **Step 1: Implement the repository**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/HydrationRepositoryImpl.kt
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.HydrationRemoteDataSource
import com.coachfoska.app.data.remote.dto.HydrationSettingsDto
import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog
import com.coachfoska.app.domain.repository.HydrationRepository

class HydrationRepositoryImpl(
    private val dataSource: HydrationRemoteDataSource
) : HydrationRepository {

    override suspend fun logWater(userId: String, amountMl: Int): Result<WaterLog> =
        runCatching { dataSource.insertWaterLog(userId, amountMl).toDomain() }

    override suspend fun getTodayLogs(userId: String): Result<List<WaterLog>> =
        runCatching { dataSource.getTodayLogs(userId).map { it.toDomain() } }

    override suspend fun deleteLog(userId: String, logId: String): Result<Unit> =
        runCatching { dataSource.deleteLog(logId) }

    override suspend fun getSettings(userId: String): Result<HydrationSettings> =
        runCatching {
            dataSource.getSettings(userId)?.toDomain() ?: HydrationSettings()
        }

    override suspend fun saveSettings(userId: String, settings: HydrationSettings): Result<Unit> =
        runCatching {
            dataSource.upsertSettings(
                HydrationSettingsDto(
                    userId = userId,
                    intervalMinutes = settings.intervalMinutes,
                    startHour = settings.startHour,
                    endHour = settings.endHour,
                    smartSuppress = settings.smartSuppress,
                    remindersEnabled = settings.remindersEnabled
                )
            )
        }
}
```

- [ ] **Step 2: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/HydrationRepositoryImpl.kt
git commit -m "feat(data): add HydrationRepositoryImpl"
```

---

## Task 7: WaterReminderScheduler Interface + Platform Stubs

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/hydration/WaterReminderScheduler.kt`
- Create: `composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/AndroidWaterReminderScheduler.kt` (stub)
- Create: `composeApp/src/iosMain/kotlin/com/coachfoska/app/hydration/IosWaterReminderScheduler.kt` (stub)

- [ ] **Step 1: Create the common interface**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/hydration/WaterReminderScheduler.kt
package com.coachfoska.app.domain.hydration

import com.coachfoska.app.domain.model.HydrationSettings

interface WaterReminderScheduler {
    fun schedule(settings: HydrationSettings, goalMl: Int)
    fun cancel()
}
```

- [ ] **Step 2: Create Android stub**

```kotlin
// composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/AndroidWaterReminderScheduler.kt
package com.coachfoska.app.hydration

import android.content.Context
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.HydrationSettings

class AndroidWaterReminderScheduler(private val context: Context) : WaterReminderScheduler {
    override fun schedule(settings: HydrationSettings, goalMl: Int) { /* implemented in Task 14 */ }
    override fun cancel() { /* implemented in Task 14 */ }
}
```

- [ ] **Step 3: Create iOS stub**

```kotlin
// composeApp/src/iosMain/kotlin/com/coachfoska/app/hydration/IosWaterReminderScheduler.kt
package com.coachfoska.app.hydration

import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.HydrationSettings

class IosWaterReminderScheduler : WaterReminderScheduler {
    override fun schedule(settings: HydrationSettings, goalMl: Int) { /* implemented in Task 15 */ }
    override fun cancel() { /* implemented in Task 15 */ }
}
```

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/hydration/WaterReminderScheduler.kt \
        composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/AndroidWaterReminderScheduler.kt \
        composeApp/src/iosMain/kotlin/com/coachfoska/app/hydration/IosWaterReminderScheduler.kt
git commit -m "feat(domain): add WaterReminderScheduler interface and platform stubs"
```

---

## Task 8: HydrationViewModel + Tests

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationState.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationIntent.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationViewModel.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/hydration/HydrationViewModelTest.kt`

- [ ] **Step 1: Create State and Intent**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationState.kt
package com.coachfoska.app.presentation.hydration

import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog

data class HydrationState(
    val isLoading: Boolean = false,
    val todayLogs: List<WaterLog> = emptyList(),
    val goalMl: Int = 2000,
    val settings: HydrationSettings = HydrationSettings(),
    val error: String? = null,
    val showCustomAmountDialog: Boolean = false
) {
    val consumedMl: Int get() = todayLogs.sumOf { it.amountMl }
    val progressFraction: Float get() = if (goalMl > 0) (consumedMl.toFloat() / goalMl).coerceIn(0f, 1f) else 0f
}
```

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationIntent.kt
package com.coachfoska.app.presentation.hydration

import com.coachfoska.app.domain.model.HydrationSettings

sealed interface HydrationIntent {
    data object LoadData : HydrationIntent
    data class LogWater(val amountMl: Int) : HydrationIntent
    data class DeleteLog(val logId: String) : HydrationIntent
    data class UpdateSettings(val settings: HydrationSettings) : HydrationIntent
    data object ShowCustomAmountDialog : HydrationIntent
    data object DismissCustomAmountDialog : HydrationIntent
}
```

- [ ] **Step 2: Write failing ViewModel tests**

```kotlin
// composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/hydration/HydrationViewModelTest.kt
package com.coachfoska.app.presentation.hydration

import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.model.WaterLog
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.datetime.Clock
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class HydrationViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val hydrationRepo: HydrationRepository = mockk()
    private val userRepo: UserRepository = mockk()
    private val scheduler: WaterReminderScheduler = mockk(relaxed = true)

    private val aUser = User(
        id = "u1", email = "a@b.com", fullName = null,
        age = null, heightCm = null,
        weightKg = 80f, goal = UserGoal.MUSCLE_GAIN,
        activityLevel = ActivityLevel.ACTIVE
    )

    private fun viewModel() = HydrationViewModel(
        hydrationRepository = hydrationRepo,
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        calculateWaterGoalUseCase = CalculateWaterGoalUseCase(),
        reminderScheduler = scheduler,
        userId = "u1"
    )

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coEvery { userRepo.getProfile("u1") } returns Result.success(aUser)
        coEvery { hydrationRepo.getTodayLogs("u1") } returns Result.success(emptyList())
        coEvery { hydrationRepo.getSettings("u1") } returns Result.success(HydrationSettings())
    }

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadData sets goalMl from profile`() = runTest {
        val vm = viewModel()
        // 80kg * 35 * 1.3 (ACTIVE) = 3640
        assertEquals(3640, vm.state.value.goalMl)
    }

    @Test
    fun `logWater adds to todayLogs`() = runTest {
        val log = WaterLog("log1", 250, Clock.System.now())
        coEvery { hydrationRepo.logWater("u1", 250) } returns Result.success(log)
        val vm = viewModel()

        vm.onIntent(HydrationIntent.LogWater(250))

        assertEquals(1, vm.state.value.todayLogs.size)
        assertEquals(250, vm.state.value.consumedMl)
    }

    @Test
    fun `deleteLog removes entry from state`() = runTest {
        val log = WaterLog("log1", 500, Clock.System.now())
        coEvery { hydrationRepo.getTodayLogs("u1") } returns Result.success(listOf(log))
        coEvery { hydrationRepo.deleteLog("u1", "log1") } returns Result.success(Unit)
        val vm = viewModel()

        vm.onIntent(HydrationIntent.DeleteLog("log1"))

        assertTrue(vm.state.value.todayLogs.isEmpty())
    }

    @Test
    fun `updateSettings persists and reschedules reminders`() = runTest {
        val newSettings = HydrationSettings(intervalMinutes = 60, remindersEnabled = true)
        coEvery { hydrationRepo.saveSettings("u1", newSettings) } returns Result.success(Unit)
        val vm = viewModel()

        vm.onIntent(HydrationIntent.UpdateSettings(newSettings))

        assertEquals(newSettings, vm.state.value.settings)
        verify { scheduler.schedule(newSettings, any()) }
    }

    @Test
    fun `updateSettings with reminders disabled calls cancel`() = runTest {
        val newSettings = HydrationSettings(remindersEnabled = false)
        coEvery { hydrationRepo.saveSettings("u1", newSettings) } returns Result.success(Unit)
        val vm = viewModel()

        vm.onIntent(HydrationIntent.UpdateSettings(newSettings))

        verify { scheduler.cancel() }
    }

    @Test
    fun `showCustomAmountDialog toggles dialog state`() = runTest {
        val vm = viewModel()
        assertFalse(vm.state.value.showCustomAmountDialog)

        vm.onIntent(HydrationIntent.ShowCustomAmountDialog)
        assertTrue(vm.state.value.showCustomAmountDialog)

        vm.onIntent(HydrationIntent.DismissCustomAmountDialog)
        assertFalse(vm.state.value.showCustomAmountDialog)
    }
}
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.hydration.HydrationViewModelTest" 2>&1 | tail -20
```

Expected: compilation error — `HydrationViewModel` not found.

- [ ] **Step 4: Implement HydrationViewModel**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationViewModel.kt
package com.coachfoska.app.presentation.hydration

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "HydrationViewModel"

class HydrationViewModel(
    private val hydrationRepository: HydrationRepository,
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val calculateWaterGoalUseCase: CalculateWaterGoalUseCase,
    private val reminderScheduler: WaterReminderScheduler,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(HydrationState())
    val state: StateFlow<HydrationState> = _state.asStateFlow()

    init {
        onIntent(HydrationIntent.LoadData)
    }

    fun onIntent(intent: HydrationIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            HydrationIntent.LoadData -> loadData()
            is HydrationIntent.LogWater -> logWater(intent.amountMl)
            is HydrationIntent.DeleteLog -> deleteLog(intent.logId)
            is HydrationIntent.UpdateSettings -> updateSettings(intent.settings)
            HydrationIntent.ShowCustomAmountDialog -> _state.update { it.copy(showCustomAmountDialog = true) }
            HydrationIntent.DismissCustomAmountDialog -> _state.update { it.copy(showCustomAmountDialog = false) }
        }
    }

    private fun loadData() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }

            val profileDeferred = async { getUserProfileUseCase(userId) }
            val logsDeferred = async { hydrationRepository.getTodayLogs(userId) }
            val settingsDeferred = async { hydrationRepository.getSettings(userId) }

            val profileResult = profileDeferred.await()
            val logsResult = logsDeferred.await()
            val settingsResult = settingsDeferred.await()

            val profile = profileResult.getOrNull()
            val goalMl = if (profile != null) calculateWaterGoalUseCase(profile) else 2000

            _state.update {
                it.copy(
                    isLoading = false,
                    todayLogs = logsResult.getOrDefault(emptyList()),
                    goalMl = goalMl,
                    settings = settingsResult.getOrDefault(it.settings),
                    error = logsResult.exceptionOrNull()?.message
                )
            }
        }
    }

    private fun logWater(amountMl: Int) {
        viewModelScope.launch {
            hydrationRepository.logWater(userId, amountMl)
                .onSuccess { log ->
                    _state.update { it.copy(todayLogs = listOf(log) + it.todayLogs) }
                }
                .onFailure { e ->
                    Napier.e("logWater failed", e, tag = TAG)
                    _state.update { it.copy(error = e.message) }
                }
        }
    }

    private fun deleteLog(logId: String) {
        viewModelScope.launch {
            hydrationRepository.deleteLog(userId, logId)
                .onSuccess {
                    _state.update { it.copy(todayLogs = it.todayLogs.filter { log -> log.id != logId }) }
                }
                .onFailure { e ->
                    Napier.e("deleteLog failed", e, tag = TAG)
                    _state.update { it.copy(error = e.message) }
                }
        }
    }

    private fun updateSettings(settings: com.coachfoska.app.domain.model.HydrationSettings) {
        viewModelScope.launch {
            hydrationRepository.saveSettings(userId, settings)
                .onSuccess {
                    _state.update { it.copy(settings = settings) }
                    if (settings.remindersEnabled) {
                        reminderScheduler.schedule(settings, _state.value.goalMl)
                    } else {
                        reminderScheduler.cancel()
                    }
                }
                .onFailure { e ->
                    Napier.e("saveSettings failed", e, tag = TAG)
                    _state.update { it.copy(error = e.message) }
                }
        }
    }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.hydration.HydrationViewModelTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/ \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/hydration/
git commit -m "feat(presentation): add HydrationViewModel with MVI state and tests"
```

---

## Task 9: Koin DI Wiring

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`
- Modify: `composeApp/src/androidMain/kotlin/com/coachfoska/app/di/AndroidModule.kt`
- Modify: `composeApp/src/iosMain/kotlin/com/coachfoska/app/di/IosModule.kt`

- [ ] **Step 1: Add hydrationModule to AppModule.kt**

In `AppModule.kt`, add the following module (after `pushModule`):

```kotlin
val hydrationModule = module {
    single { HydrationRemoteDataSource(get()) }
    single<HydrationRepository> { HydrationRepositoryImpl(get()) }
    factory { CalculateWaterGoalUseCase() }
    viewModel { (userId: String) -> HydrationViewModel(get(), get(), get(), get(), userId) }
}
```

Add these imports:
```kotlin
import com.coachfoska.app.data.remote.datasource.HydrationRemoteDataSource
import com.coachfoska.app.data.repository.HydrationRepositoryImpl
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.presentation.hydration.HydrationViewModel
```

Add `hydrationModule` to `appModules`:
```kotlin
val appModules = listOf(
    themeModule,
    networkModule,
    dataSourceModule,
    repositoryModule,
    useCaseModule,
    viewModelModule,
    chatModule,
    pushModule,
    hydrationModule   // ← add this
)
```

- [ ] **Step 2: Wire AndroidWaterReminderScheduler in androidModule**

In `AndroidModule.kt`, add:
```kotlin
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.hydration.AndroidWaterReminderScheduler

// inside androidModule:
single<WaterReminderScheduler> { AndroidWaterReminderScheduler(androidContext()) }
```

- [ ] **Step 3: Wire IosWaterReminderScheduler in iosModule**

In `IosModule.kt`, add:
```kotlin
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.hydration.IosWaterReminderScheduler

// inside iosModule:
single<WaterReminderScheduler> { IosWaterReminderScheduler() }
```

- [ ] **Step 4: Build to verify DI compiles**

```bash
./gradlew :composeApp:assembleDebug 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt \
        composeApp/src/androidMain/kotlin/com/coachfoska/app/di/AndroidModule.kt \
        composeApp/src/iosMain/kotlin/com/coachfoska/app/di/IosModule.kt
git commit -m "feat(di): wire hydration module and platform reminder schedulers"
```

---

## Task 10: HydrationScreen UI

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/hydration/HydrationScreen.kt`

- [ ] **Step 1: Implement the screen**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/hydration/HydrationScreen.kt
package com.coachfoska.app.ui.hydration

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog
import com.coachfoska.app.presentation.hydration.HydrationIntent
import com.coachfoska.app.presentation.hydration.HydrationState
import com.coachfoska.app.presentation.hydration.HydrationViewModel
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun HydrationRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: HydrationViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HydrationScreen(state = state, onIntent = viewModel::onIntent, onBackClick = onBackClick)
}

@Composable
fun HydrationScreen(
    state: HydrationState,
    onIntent: (HydrationIntent) -> Unit,
    onBackClick: () -> Unit
) {
    if (state.showCustomAmountDialog) {
        CustomAmountDialog(
            onConfirm = { amount ->
                onIntent(HydrationIntent.DismissCustomAmountDialog)
                if (amount > 0) onIntent(HydrationIntent.LogWater(amount))
            },
            onDismiss = { onIntent(HydrationIntent.DismissCustomAmountDialog) }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(28.dp)
    ) {
        Text(
            text = "WATER",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground
        )

        // Progress ring
        WaterProgressRing(
            consumed = state.consumedMl,
            goal = state.goalMl,
            fraction = state.progressFraction,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )

        // Quick-add
        QuickAddButtons(onIntent = onIntent)

        // Today's log
        if (state.todayLogs.isNotEmpty()) {
            TodayLogSection(logs = state.todayLogs, onDelete = { onIntent(HydrationIntent.DeleteLog(it)) })
        }

        // Reminder settings
        ReminderSettingsSection(settings = state.settings, onUpdate = { onIntent(HydrationIntent.UpdateSettings(it)) })

        state.error?.let {
            Text(text = it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun WaterProgressRing(consumed: Int, goal: Int, fraction: Float, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(160.dp)) {
            CircularProgressIndicator(
                progress = { fraction },
                modifier = Modifier.fillMaxSize(),
                strokeWidth = 10.dp,
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.06f)
            )
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = consumed.toString(),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "/ $goal ml",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                )
                Text(
                    text = "${(fraction * 100).toInt()}%",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        val remaining = (goal - consumed).coerceAtLeast(0)
        Text(
            text = if (remaining > 0) "$remaining ml remaining" else "Goal reached!",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
        )
    }
}

@Composable
private fun QuickAddButtons(onIntent: (HydrationIntent) -> Unit) {
    Column {
        Text(
            text = "QUICK ADD",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 2.sp
        )
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(150, 250, 500).forEach { amount ->
                val isPrimary = amount == 250
                Button(
                    onClick = { onIntent(HydrationIntent.LogWater(amount)) },
                    modifier = Modifier.weight(1f),
                    colors = if (isPrimary) ButtonDefaults.buttonColors()
                             else ButtonDefaults.outlinedButtonColors(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("$amount", fontWeight = FontWeight.Bold)
                        Text("ml", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            OutlinedButton(
                onClick = { onIntent(HydrationIntent.ShowCustomAmountDialog) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("+", fontWeight = FontWeight.Bold)
                    Text("custom", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun TodayLogSection(logs: List<WaterLog>, onDelete: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = "TODAY'S LOG",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 2.sp
        )
        logs.forEach { log ->
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.03f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${log.amountMl} ml",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f)
                    )
                    val local = log.loggedAt.toLocalDateTime(TimeZone.currentSystemDefault())
                    Text(
                        text = "${local.hour.toString().padStart(2,'0')}:${local.minute.toString().padStart(2,'0')}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                    )
                    IconButton(onClick = { onDelete(log.id) }) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "Delete",
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReminderSettingsSection(settings: HydrationSettings, onUpdate: (HydrationSettings) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
        Text(
            text = "REMINDERS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 2.sp
        )
        Spacer(Modifier.height(10.dp))
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.03f),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column {
                SettingsToggleRow(
                    label = "Enable reminders",
                    checked = settings.remindersEnabled,
                    onCheckedChange = { onUpdate(settings.copy(remindersEnabled = it)) },
                    showDivider = true
                )
                SettingsPickerRow(
                    label = "Remind every",
                    value = intervalLabel(settings.intervalMinutes),
                    enabled = settings.remindersEnabled,
                    options = listOf(30, 60, 120, 180, 240),
                    optionLabel = ::intervalLabel,
                    onSelect = { onUpdate(settings.copy(intervalMinutes = it)) },
                    showDivider = true
                )
                SettingsPickerRow(
                    label = "Active from",
                    value = "${settings.startHour}:00",
                    enabled = settings.remindersEnabled,
                    options = (5..12).toList(),
                    optionLabel = { "$it:00" },
                    onSelect = { onUpdate(settings.copy(startHour = it)) },
                    showDivider = true
                )
                SettingsPickerRow(
                    label = "Active until",
                    value = "${settings.endHour}:00",
                    enabled = settings.remindersEnabled,
                    options = (18..23).toList(),
                    optionLabel = { "$it:00" },
                    onSelect = { onUpdate(settings.copy(endHour = it)) },
                    showDivider = true
                )
                SettingsToggleRow(
                    label = "Smart suppress",
                    subtitle = "Skip if goal reached or recently logged",
                    checked = settings.smartSuppress,
                    onCheckedChange = { onUpdate(settings.copy(smartSuppress = it)) },
                    enabled = settings.remindersEnabled,
                    showDivider = false
                )
            }
        }
    }
}

private fun intervalLabel(minutes: Int): String = when {
    minutes < 60 -> "$minutes min"
    minutes == 60 -> "1 hour"
    else -> "${minutes / 60} hours"
}

@Composable
private fun SettingsToggleRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    enabled: Boolean = true,
    showDivider: Boolean = true
) {
    Column {
        Row(
            modifier = modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onBackground.copy(alpha = if (enabled) 1f else 0.4f))
                subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)) }
            }
            Switch(checked = checked, onCheckedChange = onCheckedChange, enabled = enabled)
        }
        if (showDivider) HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    }
}

@Composable
private fun <T> SettingsPickerRow(
    label: String,
    value: String,
    enabled: Boolean,
    options: List<T>,
    optionLabel: (T) -> String,
    onSelect: (T) -> Unit,
    showDivider: Boolean = true
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onBackground.copy(alpha = if (enabled) 1f else 0.4f))
            TextButton(onClick = { if (enabled) expanded = true }) {
                Text(value, color = if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f))
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(optionLabel(option)) },
                        onClick = { onSelect(option); expanded = false }
                    )
                }
            }
        }
        if (showDivider) HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    }
}

@Composable
private fun CustomAmountDialog(onConfirm: (Int) -> Unit, onDismiss: () -> Unit) {
    var text by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Custom amount") },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.filter { c -> c.isDigit() }.take(4) },
                label = { Text("ml") },
                singleLine = true
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(text.toIntOrNull() ?: 0) }) { Text("Add") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
```

- [ ] **Step 2: Build to verify compilation**

```bash
./gradlew :composeApp:assembleDebug 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/hydration/
git commit -m "feat(ui): add HydrationScreen with progress ring, quick-add, log, and reminder settings"
```

---

## Task 11: Navigation

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`

- [ ] **Step 1: Add Hydration route**

In `Routes.kt`, add under `// Nutrition`:
```kotlin
@Serializable object Hydration
```

- [ ] **Step 2: Register composable in App.kt**

Add this import at the top of `App.kt`:
```kotlin
import com.coachfoska.app.ui.hydration.HydrationRoute
```

Add `onWaterClick` to the `NutritionHubRoute` call inside `composable<MealPlan>`:
```kotlin
composable<MealPlan>(
    enterTransition = { fadeIn(tween(150)) },
    exitTransition = { fadeOut(tween(150)) },
    popEnterTransition = { fadeIn(tween(150)) },
    popExitTransition = { fadeOut(tween(150)) }
) {
    NutritionHubRoute(
        userId = currentUserId,
        onPlanClick = { navController.navigate(MealPlanDetail) },
        onHistoryClick = { navController.navigate(MealHistory) },
        onRecipesClick = { navController.navigate(RecipesList) },
        onWaterClick = { navController.navigate(Hydration) }   // ← add
    )
}
```

Add the `Hydration` composable after `composable<RecipeDetail>` and before the Chat section:
```kotlin
composable<Hydration> {
    HydrationRoute(
        userId = currentUserId,
        onBackClick = { navController.popBackStack() }
    )
}
```

Also update the `selectedTab` derivedStateOf to map `Hydration` to the Nutrition tab:
```kotlin
currentRoute?.contains("Hydration", ignoreCase = true) == true ||
currentRoute?.contains("Meal", ignoreCase = true) == true ||
// ... rest of the nutrition conditions
```

- [ ] **Step 3: Build to verify**

```bash
./gradlew :composeApp:assembleDebug 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
git commit -m "feat(nav): add Hydration route and wire into App navigation"
```

---

## Task 12: Nutrition Hub — Add Water Card

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt`

- [ ] **Step 1: Add onWaterClick param and Water card**

Replace the `NutritionHubRoute` and `NutritionHubScreen` signatures and body:

```kotlin
@Composable
fun NutritionHubRoute(
    userId: String,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    onWaterClick: () -> Unit,                    // ← add
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    NutritionHubScreen(
        state = state,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onRecipesClick = onRecipesClick,
        onWaterClick = onWaterClick              // ← add
    )
}

@Composable
fun NutritionHubScreen(
    state: NutritionState,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    onWaterClick: () -> Unit                     // ← add
) {
```

In the bottom Row section (the `Row(horizontalArrangement = Arrangement.spacedBy(10.dp))` block), replace the existing two cards with three cards, adding a Water card:

```kotlin
Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    HubImageCard(
        imageRes = Res.drawable.img_nutrition_history,
        eyebrow = "Log",
        title = "History",
        subtitle = "Past meals",
        onClick = onHistoryClick,
        modifier = Modifier.weight(1f).aspectRatio(1f)
    )
    HubImageCard(
        imageRes = Res.drawable.img_nutrition_recipes,
        eyebrow = "Browse",
        title = "Recipes",
        subtitle = "Meal ideas",
        onClick = onRecipesClick,
        modifier = Modifier.weight(1f).aspectRatio(1f)
    )
    HubImageCard(
        imageRes = Res.drawable.img_nutrition_water,   // added in Task 12 Step 2
        eyebrow = "Track",
        title = "Water",
        subtitle = "Daily intake",
        onClick = onWaterClick,
        modifier = Modifier.weight(1f).aspectRatio(1f)
    )
}
```

- [ ] **Step 2: Add a water placeholder image resource**

Place any water-themed image (PNG/JPEG, same format as existing hub images) at:
```
composeApp/src/commonMain/composeResources/drawable/img_nutrition_water.png
```

Or if you don't have one, use an existing image as a temporary stand-in:
```kotlin
imageRes = Res.drawable.img_nutrition_history,  // temporary
```
and add a TODO comment to replace with the proper image.

- [ ] **Step 3: Build to verify**

```bash
./gradlew :composeApp:assembleDebug 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt
git commit -m "feat(ui): add Water card to Nutrition Hub"
```

---

## Task 13: Home Screen — Water Progress Bar

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeState.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`

- [ ] **Step 1: Add water fields to HomeState**

In `HomeState.kt`, add two fields:
```kotlin
data class HomeState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val todayWorkout: Workout? = null,
    val nutritionSummary: DailyNutritionSummary? = null,
    val lastCoachMessage: ChatMessage? = null,
    val waterConsumedMl: Int = 0,           // ← add
    val waterGoalMl: Int = 2000,            // ← add
    val error: String? = null
)
```

- [ ] **Step 2: Update HomeViewModel to fetch water data**

Add `HydrationRepository` and `CalculateWaterGoalUseCase` to the constructor:
```kotlin
class HomeViewModel(
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val getAssignedWorkoutsUseCase: GetAssignedWorkoutsUseCase,
    private val getDailyNutritionSummaryUseCase: GetDailyNutritionSummaryUseCase,
    private val observeChatMessagesUseCase: ObserveChatMessagesUseCase,
    private val hydrationRepository: HydrationRepository,           // ← add
    private val calculateWaterGoalUseCase: CalculateWaterGoalUseCase, // ← add
    private val userId: String
) : ViewModel()
```

Add these imports:
```kotlin
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
```

In `loadData()`, add a water deferred alongside the existing ones:
```kotlin
val waterLogsDeferred = async { hydrationRepository.getTodayLogs(userId) }
```

After `val lastCoachMessage = chatDeferred.await()`, add:
```kotlin
val waterLogsResult = waterLogsDeferred.await()
val waterConsumed = waterLogsResult.getOrDefault(emptyList()).sumOf { it.amountMl }
val waterGoal = profileResult.getOrNull()?.let { calculateWaterGoalUseCase(it) } ?: 2000
```

Update the `_state.update` block to include:
```kotlin
waterConsumedMl = waterConsumed,
waterGoalMl = waterGoal,
```

- [ ] **Step 3: Update HomeViewModel DI binding in AppModule.kt**

Change the `viewModelModule` HomeViewModel binding from:
```kotlin
viewModel { (userId: String) -> HomeViewModel(get(), get(), get(), get(), userId) }
```
to:
```kotlin
viewModel { (userId: String) -> HomeViewModel(get(), get(), get(), get(), get(), get(), userId) }
```

- [ ] **Step 4: Add water bar to HomeScreen**

In `HomeScreen.kt`, update `MacroRow` to `NutritionSummaryCard` or keep the existing structure and add water below. Replace the existing nutrition `Surface` content block to add a water bar below `MacroRow`:

Inside the `Column(modifier = Modifier.padding(24.dp), ...)` that currently only has `MacroRow`:
```kotlin
Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
    state.nutritionSummary?.let { nutrition ->
        MacroRow(nutrition)
    } ?: Text(
        text = stringResource(Res.string.start_logging_meals),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
    )
    // Water progress bar — always shown
    WaterProgressRow(
        consumedMl = state.waterConsumedMl,
        goalMl = state.waterGoalMl,
        onClick = onWaterClick        // requires adding onWaterClick param — see below
    )
}
```

Add `onWaterClick: () -> Unit = {}` to `HomeScreen` and `HomeRoute` composable signatures.

In `HomeRoute`:
```kotlin
@Composable
fun HomeRoute(
    userId: String,
    onChatClick: () -> Unit = {},
    onWaterClick: () -> Unit = {},    // ← add
    viewModel: HomeViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeScreen(state = state, onIntent = viewModel::onIntent, onChatClick = onChatClick, onWaterClick = onWaterClick)
}
```

Add the `WaterProgressRow` composable at the bottom of `HomeScreen.kt`:
```kotlin
@Composable
private fun WaterProgressRow(consumedMl: Int, goalMl: Int, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        HorizontalDivider(
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
            modifier = Modifier.padding(bottom = 16.dp)
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "💧",
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = "WATER",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                letterSpacing = 1.sp,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = "$consumedMl / $goalMl ml",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
        Spacer(Modifier.height(6.dp))
        val fraction = if (goalMl > 0) (consumedMl.toFloat() / goalMl).coerceIn(0f, 1f) else 0f
        LinearProgressIndicator(
            progress = { fraction },
            modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(50)),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
        )
    }
}
```

Update `App.kt` to pass `onWaterClick` to `HomeRoute`:
```kotlin
composable<Home>(...) {
    HomeRoute(
        userId = currentUserId,
        onChatClick = { navController.navigate(HumanCoachChat) },
        onWaterClick = { navController.navigate(Hydration) }   // ← add
    )
}
```

- [ ] **Step 5: Build and verify**

```bash
./gradlew :composeApp:assembleDebug 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Run all unit tests**

```bash
./gradlew :composeApp:testDebugUnitTest 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL` — all tests pass.

- [ ] **Step 7: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/ \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
git commit -m "feat(home): add water progress bar to daily nutrition card"
```

---

## Task 14: Android WorkManager Scheduler

**Files:**
- Modify: `gradle/libs.versions.toml`
- Modify: `composeApp/build.gradle.kts`
- Modify: `composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/AndroidWaterReminderScheduler.kt`
- Create: `composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/HydrationWorker.kt`

- [ ] **Step 1: Add WorkManager to version catalog**

In `gradle/libs.versions.toml`, under `[versions]` add:
```toml
work = "2.10.0"
```

Under `[libraries]` add:
```toml
work-runtime-ktx = { module = "androidx.work:work-runtime-ktx", version.ref = "work" }
```

- [ ] **Step 2: Add WorkManager dependency to build.gradle.kts**

Inside `androidMain.dependencies { ... }`, add:
```kotlin
implementation(libs.work.runtime.ktx)
```

- [ ] **Step 3: Implement HydrationWorker**

```kotlin
// composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/HydrationWorker.kt
package com.coachfoska.app.hydration

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.domain.repository.HydrationRepository
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

private const val CHANNEL_ID = "hydration_reminders"
private const val NOTIFICATION_ID = 1001

class HydrationWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params), KoinComponent {

    private val hydrationRepository: HydrationRepository by inject()

    override suspend fun doWork(): Result {
        val userId = inputData.getString(KEY_USER_ID) ?: return Result.failure()
        val goalMl = inputData.getInt(KEY_GOAL_ML, 2000)
        val startHour = inputData.getInt(KEY_START_HOUR, 7)
        val endHour = inputData.getInt(KEY_END_HOUR, 22)
        val smartSuppress = inputData.getBoolean(KEY_SMART_SUPPRESS, true)
        val intervalMinutes = inputData.getInt(KEY_INTERVAL_MINUTES, 120)

        val currentHour = currentInstant().toLocalDateTime(TimeZone.currentSystemDefault()).hour
        if (currentHour < startHour || currentHour >= endHour) return Result.success()

        if (smartSuppress) {
            val logs = hydrationRepository.getTodayLogs(userId).getOrNull() ?: return Result.success()
            if (logs.sumOf { it.amountMl } >= goalMl) return Result.success()
            val lastLog = logs.firstOrNull()
            if (lastLog != null) {
                val minutesSinceLast = (currentInstant() - lastLog.loggedAt).inWholeMinutes
                if (minutesSinceLast < intervalMinutes / 2) return Result.success()
            }
        }

        showNotification()
        return Result.success()
    }

    private fun showNotification() {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Hydration Reminders", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Time to drink water 💧")
            .setContentText("Stay hydrated — log your water intake in Coach Foska.")
            .setAutoCancel(true)
            .build()
        manager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        const val KEY_USER_ID = "user_id"
        const val KEY_GOAL_ML = "goal_ml"
        const val KEY_START_HOUR = "start_hour"
        const val KEY_END_HOUR = "end_hour"
        const val KEY_SMART_SUPPRESS = "smart_suppress"
        const val KEY_INTERVAL_MINUTES = "interval_minutes"
        const val WORK_NAME = "hydration_reminder"
    }
}
```

- [ ] **Step 4: Implement AndroidWaterReminderScheduler**

```kotlin
// composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/AndroidWaterReminderScheduler.kt
package com.coachfoska.app.hydration

import android.content.Context
import androidx.work.*
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.HydrationSettings
import java.util.concurrent.TimeUnit

class AndroidWaterReminderScheduler(private val context: Context) : WaterReminderScheduler {

    private val workManager = WorkManager.getInstance(context)

    // userId is stored at schedule time so HydrationWorker can query Supabase.
    // Call schedule() from HydrationViewModel after the user logs in.
    var userId: String = ""

    override fun schedule(settings: HydrationSettings, goalMl: Int) {
        val inputData = workDataOf(
            HydrationWorker.KEY_USER_ID to userId,
            HydrationWorker.KEY_GOAL_ML to goalMl,
            HydrationWorker.KEY_START_HOUR to settings.startHour,
            HydrationWorker.KEY_END_HOUR to settings.endHour,
            HydrationWorker.KEY_SMART_SUPPRESS to settings.smartSuppress,
            HydrationWorker.KEY_INTERVAL_MINUTES to settings.intervalMinutes
        )
        val request = PeriodicWorkRequestBuilder<HydrationWorker>(
            settings.intervalMinutes.toLong(), TimeUnit.MINUTES
        )
            .setInputData(inputData)
            .setConstraints(Constraints(requiredNetworkType = NetworkType.CONNECTED))
            .build()

        workManager.enqueueUniquePeriodicWork(
            HydrationWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    override fun cancel() {
        workManager.cancelUniqueWork(HydrationWorker.WORK_NAME)
    }
}
```

Note: `userId` must be set before calling `schedule()`. Update the `HydrationViewModel` to pass the `userId` to the scheduler. Add `(reminderScheduler as? AndroidWaterReminderScheduler)?.userId = userId` in `HydrationViewModel.init` — or better, add a `setUserId(userId: String)` method to the `WaterReminderScheduler` interface:

Update `WaterReminderScheduler` interface:
```kotlin
interface WaterReminderScheduler {
    fun setUserId(userId: String)
    fun schedule(settings: HydrationSettings, goalMl: Int)
    fun cancel()
}
```

Update `AndroidWaterReminderScheduler`:
```kotlin
override fun setUserId(userId: String) { this.userId = userId }
```

Update `IosWaterReminderScheduler` stub:
```kotlin
override fun setUserId(userId: String) {}
```

Update `HydrationViewModel.init` to call `reminderScheduler.setUserId(userId)` before `onIntent(HydrationIntent.LoadData)`.

- [ ] **Step 5: Build to verify**

```bash
./gradlew :composeApp:assembleDebug 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add gradle/libs.versions.toml \
        composeApp/build.gradle.kts \
        composeApp/src/androidMain/kotlin/com/coachfoska/app/hydration/ \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/hydration/WaterReminderScheduler.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/hydration/HydrationViewModel.kt \
        composeApp/src/iosMain/kotlin/com/coachfoska/app/hydration/IosWaterReminderScheduler.kt
git commit -m "feat(android): implement WorkManager-based water reminder scheduler"
```

---

## Task 15: iOS Reminder Scheduler

**Files:**
- Modify: `composeApp/src/iosMain/kotlin/com/coachfoska/app/hydration/IosWaterReminderScheduler.kt`

- [ ] **Step 1: Implement iOS scheduler using UNUserNotificationCenter**

```kotlin
// composeApp/src/iosMain/kotlin/com/coachfoska/app/hydration/IosWaterReminderScheduler.kt
package com.coachfoska.app.hydration

import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.HydrationSettings
import platform.UserNotifications.*
import platform.darwin.NSObject

class IosWaterReminderScheduler : WaterReminderScheduler {

    private val center = UNUserNotificationCenter.currentNotificationCenter()

    override fun setUserId(userId: String) { /* not needed on iOS */ }

    override fun schedule(settings: HydrationSettings, goalMl: Int) {
        center.requestAuthorizationWithOptions(
            UNAuthorizationOptionAlert or UNAuthorizationOptionSound
        ) { granted, _ ->
            if (!granted) return@requestAuthorizationWithOptions
            scheduleNotifications(settings)
        }
    }

    override fun cancel() {
        center.removeAllPendingNotificationRequests()
    }

    private fun scheduleNotifications(settings: HydrationSettings) {
        center.removeAllPendingNotificationRequests()

        val content = UNMutableNotificationContent().apply {
            setTitle("Time to drink water 💧")
            setBody("Stay hydrated — log your water intake in Coach Foska.")
            setSound(UNNotificationSound.defaultSound())
        }

        // Schedule one notification per interval slot within active hours
        var hour = settings.startHour
        var requestIndex = 0
        while (hour < settings.endHour) {
            val components = NSDateComponents().apply {
                setHour(hour.toLong())
                setMinute(0)
            }
            val trigger = UNCalendarNotificationTrigger.triggerWithDateMatchingComponents(
                components, repeats = true
            )
            val request = UNNotificationRequest.requestWithIdentifier(
                "hydration_$requestIndex",
                content,
                trigger
            )
            center.addNotificationRequest(request) { _ -> }
            hour += settings.intervalMinutes / 60
            requestIndex++
        }
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
./gradlew :composeApp:iosSimulatorArm64MainKlibrary 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Run full test suite**

```bash
./gradlew :composeApp:testDebugUnitTest 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL` — all tests pass.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/iosMain/kotlin/com/coachfoska/app/hydration/IosWaterReminderScheduler.kt
git commit -m "feat(ios): implement UNUserNotificationCenter water reminder scheduler"
```
