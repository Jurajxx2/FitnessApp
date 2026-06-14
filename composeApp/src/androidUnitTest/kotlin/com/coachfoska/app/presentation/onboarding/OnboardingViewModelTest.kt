package com.coachfoska.app.presentation.onboarding

import com.coachfoska.app.domain.model.Equipment
import com.coachfoska.app.domain.model.ExperienceLevel
import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.domain.model.Gender
import com.coachfoska.app.domain.model.MuscleGroup
import com.coachfoska.app.domain.model.OnboardingData
import com.coachfoska.app.domain.model.TrainingPreference
import com.coachfoska.app.domain.repository.OnboardingRepository
import com.coachfoska.app.domain.usecase.onboarding.SaveOnboardingUseCase
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repository: OnboardingRepository = mockk()

    private fun viewModel() = OnboardingViewModel(SaveOnboardingUseCase(repository), "user-1")

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `initial state is step 0 with default data`() {
        val vm = viewModel()
        assertEquals(0, vm.state.value.currentStep)
        assertEquals(OnboardingData(), vm.state.value.data)
        assertFalse(vm.state.value.isCompleted)
    }

    @Test
    fun `selection intents update the matching field`() {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.SelectGender(Gender.FEMALE))
        vm.onIntent(OnboardingIntent.SelectGoal(FitnessGoal.GET_STRONGER))
        vm.onIntent(OnboardingIntent.SelectExperience(ExperienceLevel.ADVANCED))
        vm.onIntent(OnboardingIntent.SelectEquipment(Equipment.FULL_GYM))
        vm.onIntent(OnboardingIntent.SetFrequency(5))
        vm.onIntent(OnboardingIntent.SelectTrainingPreference(TrainingPreference.BOTH))
        vm.onIntent(OnboardingIntent.SetName("Ada"))
        val d = vm.state.value.data
        assertEquals(Gender.FEMALE, d.gender)
        assertEquals(FitnessGoal.GET_STRONGER, d.goal)
        assertEquals(ExperienceLevel.ADVANCED, d.experienceLevel)
        assertEquals(Equipment.FULL_GYM, d.equipment)
        assertEquals(5, d.frequencyPerWeek)
        assertEquals(TrainingPreference.BOTH, d.trainingPreference)
        assertEquals("Ada", d.name)
    }

    @Test
    fun `onSingleSelectAndAdvance increments step after the delay`() = runTest {
        val vm = viewModel()
        vm.onSingleSelectAndAdvance(OnboardingIntent.SelectGender(Gender.MALE))
        advanceTimeBy(350)
        assertEquals(Gender.MALE, vm.state.value.data.gender)
        assertEquals(1, vm.state.value.currentStep)
    }

    @Test
    fun `back navigation decrements and clamps at zero`() {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.NextStep)
        vm.onIntent(OnboardingIntent.NextStep)
        assertEquals(2, vm.state.value.currentStep)
        vm.onIntent(OnboardingIntent.PreviousStep)
        assertEquals(1, vm.state.value.currentStep)
        vm.onIntent(OnboardingIntent.PreviousStep)
        vm.onIntent(OnboardingIntent.PreviousStep)
        assertEquals(0, vm.state.value.currentStep)
    }

    @Test
    fun `advance clamps at the last step`() {
        val vm = viewModel()
        repeat(50) { vm.onIntent(OnboardingIntent.NextStep) }
        assertEquals(OnboardingStep.entries.size - 1, vm.state.value.currentStep)
    }

    @Test
    fun `bmi is computed from height and weight`() {
        val data = OnboardingData(heightCm = 180, weightKg = 81f)
        assertEquals(25f, data.bmi, 0.01f)
    }

    @Test
    fun `selecting FULL_BODY selects every muscle group`() {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.ToggleFocusArea(MuscleGroup.FULL_BODY))
        assertEquals(MuscleGroup.entries.toSet(), vm.state.value.data.focusAreas)
    }

    @Test
    fun `toggling FULL_BODY again clears the selection`() {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.ToggleFocusArea(MuscleGroup.FULL_BODY))
        vm.onIntent(OnboardingIntent.ToggleFocusArea(MuscleGroup.FULL_BODY))
        assertTrue(vm.state.value.data.focusAreas.isEmpty())
    }

    @Test
    fun `selecting all individual areas implies FULL_BODY`() {
        val vm = viewModel()
        MuscleGroup.individual.forEach { vm.onIntent(OnboardingIntent.ToggleFocusArea(it)) }
        assertTrue(vm.state.value.data.focusAreas.contains(MuscleGroup.FULL_BODY))
    }

    @Test
    fun `complete onboarding saves and sets isCompleted`() = runTest {
        coEvery { repository.saveResponses(any(), any()) } returns Result.success(Unit)
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.CompleteOnboarding)
        assertTrue(vm.state.value.isCompleted)
        assertFalse(vm.state.value.isSaving)
    }

    @Test
    fun `complete onboarding failure sets error and not completed`() = runTest {
        coEvery { repository.saveResponses(any(), any()) } returns Result.failure(RuntimeException("net"))
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.CompleteOnboarding)
        assertEquals("net", vm.state.value.error)
        assertFalse(vm.state.value.isCompleted)
    }
}
