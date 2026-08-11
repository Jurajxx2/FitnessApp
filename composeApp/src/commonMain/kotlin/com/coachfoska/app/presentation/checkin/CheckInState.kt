package com.coachfoska.app.presentation.checkin

import com.coachfoska.app.domain.model.CheckIn

/** Editable draft for the current week's form. */
data class CheckInForm(
    val weightKg: String = "",
    val energyLevel: Int? = null,
    val sleepQuality: Int? = null,
    val stressLevel: Int? = null,
    val trainingAdherence: String = "",
    val nutritionAdherence: Int? = null,
    val notes: String = "",
    val photoFrontPath: String? = null,
    val photoSidePath: String? = null,
)

data class CheckInState(
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val selectedPhotoSlots: Set<String> = emptySet(),
    val form: CheckInForm = CheckInForm(),
    val history: List<CheckIn> = emptyList(),
    val submitted: Boolean = false,
    val error: String? = null,
)
