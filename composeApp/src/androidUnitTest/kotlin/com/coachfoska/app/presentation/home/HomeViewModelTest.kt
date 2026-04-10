package com.coachfoska.app.presentation.home

import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.repository.ChatRepository
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.auth.aUser
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
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

    private fun viewModel() = HomeViewModel(
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        getAssignedWorkoutsUseCase = GetAssignedWorkoutsUseCase(workoutRepo),
        getDailyNutritionSummaryUseCase = GetDailyNutritionSummaryUseCase(mealRepo),
        observeChatMessagesUseCase = ObserveChatMessagesUseCase(chatRepo),
        userId = "user-1"
    )

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        every { chatRepo.observeMessages(any(), any()) } returns flowOf(emptyList())
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
}
