package com.coachfoska.app.presentation.home

import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.repository.ChatRepository
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.model.ChatType
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
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.model.WaterContainer
import kotlin.test.assertTrue
import com.coachfoska.app.domain.model.WaterLog
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.datetime.Instant
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

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
        coEvery { userRepo.getWeightHistory(any()) } returns Result.success(emptyList())
        coEvery { workoutRepo.getCurrentStreak(any()) } returns Result.success(0)
    }

    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadData success populates all state fields`() = runTest {
        val user = aUser()
        val nutrition = DailyNutritionSummary(2000f, 150f, 200f, 80f)
        coEvery { userRepo.getProfile(any()) } returns Result.success(user)
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(nutrition)

        val vm = viewModel()

        assertEquals(user, vm.state.value.user)
        assertEquals(nutrition, vm.state.value.nutritionSummary)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loadData with profile failure surfaces error to state`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.failure(RuntimeException("Unauthorized"))
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `loadData with workouts failure surfaces error to state`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("Workouts unavailable"))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
    }

    @Test
    fun `loadData partial failure still populates available data`() = runTest {
        val user = aUser()
        coEvery { userRepo.getProfile(any()) } returns Result.success(user)
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("err"))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))

        val vm = viewModel()

        assertEquals(user, vm.state.value.user) // profile loaded despite workout failure
        assertNull(vm.state.value.todayWorkout)
        assertNotNull(vm.state.value.error)
    }

    @Test
    fun `loadData filters today workout by day of week index`() = runTest {
        // Workout with dayOfWeek = null should never match today
        val workoutNoDay = Workout(id = "w1", name = "Anytime", dayOfWeek = null, durationMinutes = 60, exercises = emptyList())
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(listOf(workoutNoDay))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))

        val vm = viewModel()

        assertNull(vm.state.value.todayWorkout) // null dayOfWeek never matches
    }

    @Test
    fun `Refresh intent triggers reload`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))
        val vm = viewModel()

        vm.onIntent(HomeIntent.Refresh)

        assertNull(vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `loadData computes macro targets from profile`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))

        val vm = viewModel()
        val targets = vm.state.value.macroTargets

        assertNotNull(targets)
        assertEquals(135, targets.proteinG.toInt())
    }

    @Test
    fun `quick add water uses favorite container volume`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))
        coEvery { hydrationRepo.getContainers("user-1") } returns Result.success(
            listOf(
                WaterContainer(id = "c1", name = "Glass", volumeMl = 250),
                WaterContainer(id = "c2", name = "Bottle", volumeMl = 500, isFavorite = true),
            )
        )
        coEvery { hydrationRepo.logWater("user-1", 500) } returns
            Result.success(WaterLog(id = "w1", amountMl = 500, loggedAt = Instant.parse("2026-06-12T10:00:00Z")))

        val vm = viewModel()
        val before = vm.state.value.waterConsumedMl
        vm.onIntent(HomeIntent.QuickAddWater)

        assertEquals(before + 500, vm.state.value.waterConsumedMl)
        coVerify { hydrationRepo.logWater("user-1", 500) }
    }

    @Test
    fun `quick add water falls back to 250ml without containers`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))
        coEvery { hydrationRepo.getContainers("user-1") } returns Result.success(emptyList())
        coEvery { hydrationRepo.logWater("user-1", 250) } returns
            Result.success(WaterLog(id = "w1", amountMl = 250, loggedAt = Instant.parse("2026-06-12T10:00:00Z")))

        val vm = viewModel()
        vm.onIntent(HomeIntent.QuickAddWater)

        coVerify { hydrationRepo.logWater("user-1", 250) }
    }

    @Test
    fun `quick add water uses first container when none is favorite`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))
        coEvery { hydrationRepo.getContainers("user-1") } returns Result.success(
            listOf(
                WaterContainer(id = "c1", name = "Small", volumeMl = 300),
                WaterContainer(id = "c2", name = "Large", volumeMl = 500),
            )
        )
        coEvery { hydrationRepo.logWater("user-1", 300) } returns
            Result.success(WaterLog(id = "w1", amountMl = 300, loggedAt = Instant.parse("2026-06-12T10:00:00Z")))

        val vm = viewModel()
        vm.onIntent(HomeIntent.QuickAddWater)

        coVerify { hydrationRepo.logWater("user-1", 300) }
    }

    @Test
    fun `quick add water reverts on failure`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))
        coEvery { hydrationRepo.getContainers("user-1") } returns Result.success(emptyList())
        coEvery { hydrationRepo.logWater("user-1", 250) } returns Result.failure(RuntimeException("offline"))

        val vm = viewModel()
        val before = vm.state.value.waterConsumedMl
        vm.onIntent(HomeIntent.QuickAddWater)

        assertEquals(before, vm.state.value.waterConsumedMl)
        assertNotNull(vm.state.value.error)
    }

    @Test
    fun `loadData populates workouts and workout history for weekly activity`() = runTest {
        val workout = Workout(id = "w1", name = "Push", dayOfWeek = null, durationMinutes = 45, exercises = emptyList())
        val log = WorkoutLog(
            id = "l1", userId = "user-1", workoutId = "w1", workoutName = "Push",
            durationMinutes = 45, notes = null, exerciseLogs = emptyList(),
            loggedAt = Instant.parse("2026-06-22T10:00:00Z"),
        )
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(listOf(workout))
        coEvery { workoutRepo.getWorkoutHistory(any()) } returns Result.success(listOf(log))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))

        val vm = viewModel()

        assertEquals(listOf(workout), vm.state.value.workouts)
        assertEquals(listOf(log), vm.state.value.workoutHistory)
    }

    @Test
    fun `loadData history failure degrades to empty list without breaking load`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { workoutRepo.getWorkoutHistory(any()) } returns Result.failure(RuntimeException("history offline"))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))

        val vm = viewModel()

        assertTrue(vm.state.value.workoutHistory.isEmpty())
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }
}
