package com.coachfoska.app.presentation.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.auth.SignOutUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.profile.GetWeightHistoryUseCase
import com.coachfoska.app.domain.usecase.profile.LogWeightUseCase
import com.coachfoska.app.domain.usecase.profile.UpdateUserProfileUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ProfileViewModel"

class ProfileViewModel(
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val updateUserProfileUseCase: UpdateUserProfileUseCase,
    private val getWeightHistoryUseCase: GetWeightHistoryUseCase,
    private val logWeightUseCase: LogWeightUseCase,
    private val signOutUseCase: SignOutUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileState())
    val state: StateFlow<ProfileState> = _state.asStateFlow()

    init {
        onIntent(ProfileIntent.LoadProfile)
    }

    fun onIntent(intent: ProfileIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            ProfileIntent.LoadProfile -> loadProfile()
            ProfileIntent.LoadWeightHistory -> loadWeightHistory()
            is ProfileIntent.UpdateProfile -> updateProfile(intent)
            is ProfileIntent.LogWeight -> logWeight(intent)
            ProfileIntent.SignOut -> signOut()
            ProfileIntent.DismissError -> _state.update { it.copy(error = null) }
            ProfileIntent.SignedOut -> _state.update { it.copy(signedOut = false) }
        }
    }

    private fun loadProfile() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getUserProfileUseCase(userId)
                .onSuccess { user -> _state.update { it.copy(isLoading = false, user = user) } }
                .onFailure { e ->
                    Napier.e("loadProfile failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    private fun loadWeightHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isWeightHistoryLoading = true) }
            getWeightHistoryUseCase(userId)
                .onSuccess { entries -> _state.update { it.copy(isWeightHistoryLoading = false, weightHistory = entries) } }
                .onFailure { e ->
                    Napier.e("loadWeightHistory failed", e, tag = TAG)
                    _state.update { it.copy(isWeightHistoryLoading = false, error = e.message) }
                }
        }
    }

    private fun updateProfile(intent: ProfileIntent.UpdateProfile) {
        viewModelScope.launch {
            _state.update { it.copy(isSavingProfile = true) }
            updateUserProfileUseCase(
                userId = userId,
                fullName = intent.fullName,
                heightCm = intent.heightCm,
                weightKg = intent.weightKg,
                goal = intent.goal,
                activityLevel = intent.activityLevel
            )
                .onSuccess { user ->
                    Napier.i("Profile updated", tag = TAG)
                    _state.update { it.copy(isSavingProfile = false, user = user) }
                }
                .onFailure { e ->
                    Napier.e("updateProfile failed", e, tag = TAG)
                    _state.update { it.copy(isSavingProfile = false, error = e.message) }
                }
        }
    }

    private fun logWeight(intent: ProfileIntent.LogWeight) {
        viewModelScope.launch {
            logWeightUseCase(userId, intent.weightKg, intent.date, intent.notes)
                .onSuccess { entry ->
                    Napier.i("Weight logged: ${intent.weightKg}kg", tag = TAG)
                    _state.update { it.copy(weightHistory = listOf(entry) + it.weightHistory) }
                }
                .onFailure { e ->
                    Napier.e("logWeight failed", e, tag = TAG)
                    _state.update { it.copy(error = e.message) }
                }
        }
    }

    private fun signOut() {
        viewModelScope.launch {
            _state.update { it.copy(isSigningOut = true) }
            signOutUseCase()
                .onSuccess {
                    Napier.i("Signed out", tag = TAG)
                    _state.update { it.copy(isSigningOut = false, signedOut = true) }
                }
                .onFailure { e ->
                    Napier.e("signOut failed", e, tag = TAG)
                    _state.update { it.copy(isSigningOut = false, error = e.message) }
                }
        }
    }
}
