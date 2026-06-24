package com.coachfoska.app.presentation.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.MuscleGroup
import com.coachfoska.app.domain.model.OnboardingData
import com.coachfoska.app.domain.usecase.onboarding.SaveOnboardingUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "OnboardingViewModel"
private const val AUTO_ADVANCE_DELAY_MS = 300L
private const val NAV_LOCK_MS = 350L

class OnboardingViewModel(
    private val saveOnboardingUseCase: SaveOnboardingUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(OnboardingState())
    val state: StateFlow<OnboardingState> = _state.asStateFlow()

    /** Blocks a second advance/back while a transition is in flight (defeats double-tap skip). */
    private var navLocked = false

    fun onIntent(intent: OnboardingIntent) {
        when (intent) {
            is OnboardingIntent.SelectGender -> updateData { copy(gender = intent.gender) }
            is OnboardingIntent.SelectGoal -> updateData { copy(goal = intent.goal) }
            is OnboardingIntent.SelectExperience -> updateData { copy(experienceLevel = intent.level) }
            is OnboardingIntent.ToggleFocusArea -> updateData { toggleFocusArea(intent.area) }
            is OnboardingIntent.ToggleTrainingDay -> updateData {
                val updated = trainingDays.toMutableSet()
                if (!updated.add(intent.day)) updated.remove(intent.day)
                copy(trainingDays = updated)
            }
            is OnboardingIntent.SetNotificationsEnabled -> updateData { copy(notificationsEnabled = intent.enabled) }
            is OnboardingIntent.SelectEquipment -> updateData { copy(equipment = intent.equipment) }
            is OnboardingIntent.SetAge -> updateData { copy(age = intent.age) }
            is OnboardingIntent.SetHeight -> updateData { copy(heightCm = intent.cm) }
            is OnboardingIntent.SetWeight -> updateData { copy(weightKg = intent.kg) }
            is OnboardingIntent.ToggleMetric -> updateData { copy(useMetric = intent.metric) }
            is OnboardingIntent.SelectTrainingPreference -> updateData { copy(trainingPreference = intent.pref) }
            is OnboardingIntent.SetName -> updateData { copy(name = intent.name) }
            OnboardingIntent.NextStep -> advanceStep()
            OnboardingIntent.PreviousStep -> goBack()
            OnboardingIntent.CompleteOnboarding -> completeOnboarding()
        }
    }

    /** Single-select screens: apply selection, brief pause for the animation, then advance. */
    fun onSingleSelectAndAdvance(intent: OnboardingIntent) {
        onIntent(intent)
        viewModelScope.launch {
            delay(AUTO_ADVANCE_DELAY_MS)
            advanceStep()
        }
    }

    private fun OnboardingData.toggleFocusArea(area: MuscleGroup): OnboardingData {
        val newAreas = if (area == MuscleGroup.FULL_BODY) {
            if (focusAreas.contains(MuscleGroup.FULL_BODY)) emptySet()
            else MuscleGroup.entries.toSet()
        } else {
            val updated = focusAreas.toMutableSet()
            if (!updated.add(area)) updated.remove(area)
            if (updated.containsAll(MuscleGroup.individual)) updated.add(MuscleGroup.FULL_BODY)
            else updated.remove(MuscleGroup.FULL_BODY)
            updated
        }
        return copy(focusAreas = newAreas)
    }

    private fun updateData(update: OnboardingData.() -> OnboardingData) {
        _state.update { it.copy(data = it.data.update()) }
    }

    private fun advanceStep() {
        if (navLocked) return
        navLocked = true
        _state.update {
            it.copy(currentStep = (it.currentStep + 1).coerceAtMost(OnboardingStep.entries.size - 1))
        }
        viewModelScope.launch {
            delay(NAV_LOCK_MS)
            navLocked = false
        }
    }

    private fun goBack() {
        if (navLocked) return
        navLocked = true
        _state.update { it.copy(currentStep = (it.currentStep - 1).coerceAtLeast(0)) }
        viewModelScope.launch {
            delay(NAV_LOCK_MS)
            navLocked = false
        }
    }

    private fun completeOnboarding() {
        viewModelScope.launch {
            _state.update { it.copy(isSaving = true, error = null) }
            saveOnboardingUseCase(userId, _state.value.data)
                .onSuccess {
                    Napier.i("Onboarding saved", tag = TAG)
                    _state.update { it.copy(isSaving = false, isCompleted = true) }
                }
                .onFailure { e ->
                    Napier.e("Onboarding save failed", e, tag = TAG)
                    _state.update { it.copy(isSaving = false, error = e.message ?: "Save failed") }
                }
        }
    }
}
