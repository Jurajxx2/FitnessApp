package com.coachfoska.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.config.GetAppLinksUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "SettingsViewModel"

class SettingsViewModel(
    private val getAppLinksUseCase: GetAppLinksUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsState())
    val state: StateFlow<SettingsState> = _state.asStateFlow()

    init {
        loadLinks()
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
