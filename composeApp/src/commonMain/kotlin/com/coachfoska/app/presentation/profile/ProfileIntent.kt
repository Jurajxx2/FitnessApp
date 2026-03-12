package com.coachfoska.app.presentation.profile

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import kotlinx.datetime.LocalDate

sealed interface ProfileIntent {
    data object LoadProfile : ProfileIntent
    data object LoadWeightHistory : ProfileIntent
    data class UpdateProfile(
        val fullName: String? = null,
        val heightCm: Float? = null,
        val weightKg: Float? = null,
        val goal: UserGoal? = null,
        val activityLevel: ActivityLevel? = null
    ) : ProfileIntent
    data class LogWeight(val weightKg: Float, val date: LocalDate, val notes: String? = null) : ProfileIntent
    data object SignOut : ProfileIntent
    data object DismissError : ProfileIntent
    data object SignedOut : ProfileIntent
}
