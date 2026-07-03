package com.coachfoska.app.presentation.home

import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.ChatRepository
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.auth.aUser
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.hydration.GetWaterContainersUseCase
import com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.profile.GetWeightHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelMetricsTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val userRepo: UserRepository = mockk()
    private val workoutRepo: WorkoutRepository = mockk()
    private val mealRepo: MealRepository = mockk()
    private val chatRepo: ChatRepository = mockk()
    private val hydrationRepo: HydrationRepository = mockk()

    private fun viewModel() = HomeViewModel(
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        getAssignedWorkoutsUseCase = GetAssignedWorkoutsUseCase(workoutRepo),
        getDailyNutritionSummaryUseCase = GetDailyNutritionSummaryUseCase(mealRepo),
        observeChatMessagesUseCase = ObserveChatMessagesUseCase(chatRepo),
        hydrationRepository = hydrationRepo,
        calculateWaterGoalUseCase = CalculateWaterGoalUseCase(),
        calculateMacroTargetsUseCase = CalculateMacroTargetsUseCase(),
        getWaterContainersUseCase = GetWaterContainersUseCase(hydrationRepo),
        getWorkoutHistoryUseCase = GetWorkoutHistoryUseCase(workoutRepo),
        getWeightHistoryUseCase = GetWeightHistoryUseCase(userRepo),
        workoutRepository = workoutRepo,
        userId = "user-1"
    )

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        every { chatRepo.observeMessages(any(), any()) } returns flowOf(emptyList())
        coEvery { hydrationRepo.getTodayLogs(any()) } returns Result.success(emptyList())
        coEvery { hydrationRepo.getContainers(any()) } returns Result.success(emptyList())
        coEvery { workoutRepo.getWorkoutHistory(any()) } returns Result.success(emptyList())
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(
            DailyNutritionSummary(0f, 0f, 0f, 0f)
        )
        coEvery { userRepo.getWeightHistory(any()) } returns Result.success(emptyList())
        coEvery { workoutRepo.getCurrentStreak(any()) } returns Result.success(0)
    }

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    /**
     * 2 logs from this week (Monday + Tuesday of the current week) + 1 log from last week
     * → weekWorkoutsDone == 2. Uses epoch-based dynamic dates so the test is date-agnostic.
     */
    @Test
    fun `weekWorkoutsDone counts logs since monday only`() = runTest {
        val today = todayDate()
        val todayEpoch = today.toEpochDays()
        // ordinal: 0 = Monday, so Monday is today - ordinal
        val mondayEpoch = todayEpoch - today.dayOfWeek.ordinal
        val secondsPerDay = 86400L
        val nineAmSeconds = 9L * 3600L

        fun logAt(epochDay: Long) = Instant.fromEpochSeconds(epochDay * secondsPerDay + nineAmSeconds)

        val thisWeekLog1 = WorkoutLog(
            id = "log-tw1", userId = "user-1", workoutId = null, workoutName = "Push",
            durationMinutes = 45, notes = null, exerciseLogs = emptyList(),
            loggedAt = logAt(mondayEpoch),
        )
        val thisWeekLog2 = WorkoutLog(
            id = "log-tw2", userId = "user-1", workoutId = null, workoutName = "Pull",
            durationMinutes = 50, notes = null, exerciseLogs = emptyList(),
            loggedAt = logAt(mondayEpoch + 1),  // Tuesday of this week
        )
        val lastWeekLog = WorkoutLog(
            id = "log-lw1", userId = "user-1", workoutId = null, workoutName = "Legs",
            durationMinutes = 60, notes = null, exerciseLogs = emptyList(),
            loggedAt = logAt(mondayEpoch - 2),  // Two days before Monday = last week
        )
        coEvery { workoutRepo.getWorkoutHistory("user-1") } returns Result.success(
            listOf(thisWeekLog1, thisWeekLog2, lastWeekLog)
        )

        val vm = viewModel()

        assertEquals(2, vm.state.value.weekWorkoutsDone)
    }

    /**
     * Empty history + empty assigned workouts → isFirstRun == true.
     */
    @Test
    fun `firstRun is true when no history and no assigned workouts`() = runTest {
        // Default setUp stubs return empty lists for both → isFirstRun should be true.
        val vm = viewModel()

        assertTrue(vm.state.value.isFirstRun)
    }

    /**
     * Latest entry: 80.0 kg (today). Reference entry: 82.5 kg (35 days ago).
     * 30-day reference point → closest entry is the 35-days-ago one.
     * weightDeltaKg = 80.0 - 82.5 = -2.5f.
     */
    @Test
    fun `weightDelta is latest minus entry closest to 30 days ago`() = runTest {
        val today = todayDate()
        val todayEpoch = today.toEpochDays()
        val thirtyFiveDaysAgoDate = LocalDate.fromEpochDays(todayEpoch - 35)

        coEvery { userRepo.getWeightHistory("user-1") } returns Result.success(
            listOf(
                WeightEntry(id = "w1", userId = "user-1", weightKg = 80.0f, recordedAt = today),
                WeightEntry(id = "w2", userId = "user-1", weightKg = 82.5f, recordedAt = thirtyFiveDaysAgoDate),
            )
        )

        val vm = viewModel()

        assertEquals(80.0f, vm.state.value.currentWeightKg)
        assertNotNull(vm.state.value.weightDeltaKg)
        assertEquals(-2.5f, vm.state.value.weightDeltaKg)
    }
}
