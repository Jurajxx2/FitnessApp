package com.coachfoska.app.presentation.settings

data class SettingsState(
    val isLoading: Boolean = false,
    val privacyPolicyUrl: String = "",
    val termsOfServiceUrl: String = "",
    val accountDeletionUrl: String = "",
    val error: String? = null
)
