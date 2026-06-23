package com.coachfoska.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.auth.GetCurrentUserUseCase
import com.coachfoska.app.domain.usecase.config.GetAppLinksUseCase
import com.coachfoska.app.domain.usecase.debug.ResetOnboardingUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "SettingsViewModel"

class SettingsViewModel(
    private val getAppLinksUseCase: GetAppLinksUseCase,
    private val getCurrentUserUseCase: GetCurrentUserUseCase,
    private val resetOnboardingUseCase: ResetOnboardingUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsState())
    val state: StateFlow<SettingsState> = _state.asStateFlow()

    init {
        loadLinks()
    }

    fun debugResetOnboarding() {
        viewModelScope.launch {
            _state.update { it.copy(debugResetOnboardingLoading = true, debugResetOnboardingSuccess = false) }
            val userId = getCurrentUserUseCase()?.id
            if (userId == null) {
                Napier.e("debugResetOnboarding: no current user", tag = TAG)
                _state.update { it.copy(debugResetOnboardingLoading = false, error = "No authenticated user") }
                return@launch
            }
            resetOnboardingUseCase(userId)
                .onSuccess {
                    Napier.d("onboarding_complete reset for $userId", tag = TAG)
                    _state.update { it.copy(debugResetOnboardingLoading = false, debugResetOnboardingSuccess = true) }
                }
                .onFailure { e ->
                    Napier.e("debugResetOnboarding failed", e, tag = TAG)
                    _state.update { it.copy(debugResetOnboardingLoading = false, error = e.message) }
                }
        }
    }

    private fun loadLinks() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getAppLinksUseCase()
                .onSuccess { links ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            privacyPolicyUrl = links.privacyPolicyUrl,
                            termsOfServiceUrl = links.termsOfServiceUrl,
                            accountDeletionUrl = links.accountDeletionUrl
                        )
                    }
                }
                .onFailure { e ->
                    Napier.e("loadLinks failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }
}
