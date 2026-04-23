package com.coachfoska.app.presentation.onboarding

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.profile.CompleteOnboardingUseCase
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val userRepository: UserRepository = mockk()

    private fun viewModel() = OnboardingViewModel(
        completeOnboardingUseCase = CompleteOnboardingUseCase(userRepository),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `initial state has all fields empty and flags false`() {
        val vm = viewModel()
        assertNull(vm.state.value.selectedGoal)
        assertEquals("", vm.state.value.heightInput)
        assertEquals("", vm.state.value.weightInput)
        assertEquals("", vm.state.value.ageInput)
        assertNull(vm.state.value.selectedActivityLevel)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
        assertFalse(vm.state.value.onboardingComplete)
    }

    @Test
    fun `GoalSelected updates selectedGoal`() {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.GoalSelected(UserGoal.WEIGHT_LOSS))
        assertEquals(UserGoal.WEIGHT_LOSS, vm.state.value.selectedGoal)
    }

    @Test
    fun `field input intents update height, weight, and age`() {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.HeightChanged("175"))
        vm.onIntent(OnboardingIntent.WeightChanged("80"))
        vm.onIntent(OnboardingIntent.AgeChanged("30"))
        assertEquals("175", vm.state.value.heightInput)
        assertEquals("80", vm.state.value.weightInput)
        assertEquals("30", vm.state.value.ageInput)
    }

    @Test
    fun `CompleteOnboarding with invalid height sets error without calling repository`() = runTest {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.GoalSelected(UserGoal.MUSCLE_GAIN))
        vm.onIntent(OnboardingIntent.ActivityLevelSelected(ActivityLevel.MODERATELY_ACTIVE))
        vm.onIntent(OnboardingIntent.HeightChanged("not-a-number"))
        vm.onIntent(OnboardingIntent.WeightChanged("80"))
        vm.onIntent(OnboardingIntent.AgeChanged("30"))

        vm.onIntent(OnboardingIntent.CompleteOnboarding)

        assertEquals("Invalid height", vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
        assertFalse(vm.state.value.onboardingComplete)
    }

    @Test
    fun `CompleteOnboarding with invalid age sets error`() = runTest {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.GoalSelected(UserGoal.MUSCLE_GAIN))
        vm.onIntent(OnboardingIntent.ActivityLevelSelected(ActivityLevel.MODERATELY_ACTIVE))
        vm.onIntent(OnboardingIntent.HeightChanged("175"))
        vm.onIntent(OnboardingIntent.WeightChanged("80"))
        vm.onIntent(OnboardingIntent.AgeChanged("not-an-age"))

        vm.onIntent(OnboardingIntent.CompleteOnboarding)

        assertEquals("Invalid age", vm.state.value.error)
    }

    @Test
    fun `CompleteOnboarding with invalid weight sets error without calling repository`() = runTest {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.GoalSelected(UserGoal.MUSCLE_GAIN))
        vm.onIntent(OnboardingIntent.ActivityLevelSelected(ActivityLevel.MODERATELY_ACTIVE))
        vm.onIntent(OnboardingIntent.HeightChanged("175"))
        vm.onIntent(OnboardingIntent.WeightChanged("not-a-number"))
        vm.onIntent(OnboardingIntent.AgeChanged("30"))

        vm.onIntent(OnboardingIntent.CompleteOnboarding)

        assertEquals("Invalid weight", vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
        assertFalse(vm.state.value.onboardingComplete)
    }

    @Test
    fun `CompleteOnboarding success sets onboardingComplete true`() = runTest {
        coEvery {
            userRepository.completeOnboarding(any(), any(), any(), any(), any(), any())
        } returns Result.success(Unit)
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.GoalSelected(UserGoal.MUSCLE_GAIN))
        vm.onIntent(OnboardingIntent.ActivityLevelSelected(ActivityLevel.MODERATELY_ACTIVE))
        vm.onIntent(OnboardingIntent.HeightChanged("175"))
        vm.onIntent(OnboardingIntent.WeightChanged("80"))
        vm.onIntent(OnboardingIntent.AgeChanged("30"))

        vm.onIntent(OnboardingIntent.CompleteOnboarding)

        assertTrue(vm.state.value.onboardingComplete)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `CompleteOnboarding failure sets error message`() = runTest {
        coEvery {
            userRepository.completeOnboarding(any(), any(), any(), any(), any(), any())
        } returns Result.failure(RuntimeException("Network error"))
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.GoalSelected(UserGoal.MUSCLE_GAIN))
        vm.onIntent(OnboardingIntent.ActivityLevelSelected(ActivityLevel.MODERATELY_ACTIVE))
        vm.onIntent(OnboardingIntent.HeightChanged("175"))
        vm.onIntent(OnboardingIntent.WeightChanged("80"))
        vm.onIntent(OnboardingIntent.AgeChanged("30"))

        vm.onIntent(OnboardingIntent.CompleteOnboarding)

        assertEquals("Network error", vm.state.value.error)
        assertFalse(vm.state.value.onboardingComplete)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `NavigatedToHome resets onboardingComplete flag`() = runTest {
        coEvery {
            userRepository.completeOnboarding(any(), any(), any(), any(), any(), any())
        } returns Result.success(Unit)
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.GoalSelected(UserGoal.MUSCLE_GAIN))
        vm.onIntent(OnboardingIntent.ActivityLevelSelected(ActivityLevel.MODERATELY_ACTIVE))
        vm.onIntent(OnboardingIntent.HeightChanged("175"))
        vm.onIntent(OnboardingIntent.WeightChanged("80"))
        vm.onIntent(OnboardingIntent.AgeChanged("30"))
        vm.onIntent(OnboardingIntent.CompleteOnboarding)
        assertTrue(vm.state.value.onboardingComplete)

        vm.onIntent(OnboardingIntent.NavigatedToHome)

        assertFalse(vm.state.value.onboardingComplete)
    }

    @Test
    fun `DismissError clears error`() = runTest {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.GoalSelected(UserGoal.MUSCLE_GAIN))
        vm.onIntent(OnboardingIntent.ActivityLevelSelected(ActivityLevel.MODERATELY_ACTIVE))
        vm.onIntent(OnboardingIntent.HeightChanged("bad"))
        vm.onIntent(OnboardingIntent.WeightChanged("80"))
        vm.onIntent(OnboardingIntent.AgeChanged("30"))
        vm.onIntent(OnboardingIntent.CompleteOnboarding)
        assertNotNull(vm.state.value.error)

        vm.onIntent(OnboardingIntent.DismissError)

        assertNull(vm.state.value.error)
    }
}
