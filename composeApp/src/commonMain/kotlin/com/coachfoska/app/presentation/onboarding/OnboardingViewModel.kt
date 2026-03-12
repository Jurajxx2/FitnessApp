package com.coachfoska.app.presentation.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.usecase.profile.CompleteOnboardingUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class OnboardingViewModel(
    private val completeOnboardingUseCase: CompleteOnboardingUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(OnboardingState())
    val state: StateFlow<OnboardingState> = _state.asStateFlow()

    fun onIntent(intent: OnboardingIntent) {
        when (intent) {
            is OnboardingIntent.GoalSelected -> _state.update { it.copy(selectedGoal = intent.goal) }
            is OnboardingIntent.HeightChanged -> _state.update { it.copy(heightInput = intent.height) }
            is OnboardingIntent.WeightChanged -> _state.update { it.copy(weightInput = intent.weight) }
            is OnboardingIntent.AgeChanged -> _state.update { it.copy(ageInput = intent.age) }
            is OnboardingIntent.ActivityLevelSelected -> _state.update { it.copy(selectedActivityLevel = intent.level) }
            is OnboardingIntent.CompleteOnboarding -> completeOnboarding()
            is OnboardingIntent.DismissError -> _state.update { it.copy(error = null) }
            is OnboardingIntent.NavigatedToHome -> _state.update { it.copy(onboardingComplete = false) }
        }
    }

    private fun completeOnboarding() {
        val s = _state.value
        val goal = s.selectedGoal ?: return
        val activityLevel = s.selectedActivityLevel ?: return
        val height = s.heightInput.toFloatOrNull() ?: run {
            _state.update { it.copy(error = "Invalid height") }; return
        }
        val weight = s.weightInput.toFloatOrNull() ?: run {
            _state.update { it.copy(error = "Invalid weight") }; return
        }
        val age = s.ageInput.toIntOrNull() ?: run {
            _state.update { it.copy(error = "Invalid age") }; return
        }

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            completeOnboardingUseCase(userId, goal, height, weight, age, activityLevel)
                .onSuccess { _state.update { it.copy(isLoading = false, onboardingComplete = true) } }
                .onFailure { e -> _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to save profile") } }
        }
    }
}
