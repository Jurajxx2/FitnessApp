package com.coachfoska.app.presentation.profile

import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.WeightEntry

data class ProfileState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val weightHistory: List<WeightEntry> = emptyList(),
    val isWeightHistoryLoading: Boolean = false,
    val isSavingProfile: Boolean = false,
    val isSigningOut: Boolean = false,
    val signedOut: Boolean = false,
    val error: String? = null
)
