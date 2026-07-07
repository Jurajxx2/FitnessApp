package com.coachfoska.app.presentation.checkin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.domain.usecase.checkin.GetCheckInHistoryUseCase
import com.coachfoska.app.domain.usecase.checkin.GetCurrentWeekCheckInUseCase
import com.coachfoska.app.domain.usecase.checkin.SubmitCheckInUseCase
import com.coachfoska.app.domain.usecase.checkin.UploadCheckInPhotoUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.minus

class CheckInViewModel(
    private val submitCheckInUseCase: SubmitCheckInUseCase,
    private val getCheckInHistoryUseCase: GetCheckInHistoryUseCase,
    private val getCurrentWeekCheckInUseCase: GetCurrentWeekCheckInUseCase,
    private val uploadCheckInPhotoUseCase: UploadCheckInPhotoUseCase,
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val userId: String,
) : ViewModel() {

    private companion object { const val TAG = "CheckInViewModel" }

    private val _state = MutableStateFlow(CheckInState())
    val state: StateFlow<CheckInState> = _state.asStateFlow()

    private val weekOf: LocalDate = currentWeekMonday()

    init { onIntent(CheckInIntent.Load) }

    fun onIntent(intent: CheckInIntent) {
        when (intent) {
            CheckInIntent.Load -> load()
            is CheckInIntent.WeightChanged -> updateForm { it.copy(weightKg = intent.value) }
            is CheckInIntent.EnergyChanged -> updateForm { it.copy(energyLevel = intent.value) }
            is CheckInIntent.SleepChanged -> updateForm { it.copy(sleepQuality = intent.value) }
            is CheckInIntent.StressChanged -> updateForm { it.copy(stressLevel = intent.value) }
            is CheckInIntent.TrainingAdherenceChanged -> updateForm { it.copy(trainingAdherence = intent.value) }
            is CheckInIntent.NutritionAdherenceChanged -> updateForm { it.copy(nutritionAdherence = intent.value) }
            is CheckInIntent.NotesChanged -> updateForm { it.copy(notes = intent.value) }
            is CheckInIntent.PhotoPicked -> uploadPhoto(intent.slot, intent.bytes)
            CheckInIntent.Submit -> submit()
            CheckInIntent.ClearError -> _state.update { it.copy(error = null) }
        }
    }

    private fun updateForm(block: (CheckInForm) -> CheckInForm) =
        _state.update { it.copy(form = block(it.form)) }

    private fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            // History
            getCheckInHistoryUseCase(userId)
                .onSuccess { list -> _state.update { it.copy(history = list) } }
                .onFailure { e -> Napier.e("history failed", e, tag = TAG) }
            // Existing draft for this week, else prefill weight from profile.
            val existing = getCurrentWeekCheckInUseCase(userId, weekOf).getOrNull()
            if (existing != null) {
                _state.update { it.copy(form = existing.toForm()) }
            } else {
                getUserProfileUseCase(userId).onSuccess { user ->
                    user.weightKg?.let { w -> updateForm { f -> f.copy(weightKg = w.toString()) } }
                }
            }
            _state.update { it.copy(isLoading = false) }
        }
    }

    private fun uploadPhoto(slot: String, bytes: ByteArray) {
        viewModelScope.launch {
            _state.update { it.copy(isUploadingPhoto = true) }
            uploadCheckInPhotoUseCase(userId, weekOf, slot, bytes)
                .onSuccess { path ->
                    updateForm { f -> if (slot == "front") f.copy(photoFrontPath = path) else f.copy(photoSidePath = path) }
                }
                .onFailure { e ->
                    Napier.e("photo upload failed", e, tag = TAG)
                    _state.update { it.copy(error = e.message ?: "Photo upload failed") }
                }
            _state.update { it.copy(isUploadingPhoto = false) }
        }
    }

    private fun submit() {
        viewModelScope.launch {
            _state.update { it.copy(isSubmitting = true, error = null) }
            val f = _state.value.form
            val checkIn = CheckIn(
                id = "",
                userId = userId,
                weekOf = weekOf,
                weightKg = f.weightKg.toFloatOrNull(),
                energyLevel = f.energyLevel,
                sleepQuality = f.sleepQuality,
                stressLevel = f.stressLevel,
                trainingAdherence = f.trainingAdherence.toIntOrNull(),
                nutritionAdherence = f.nutritionAdherence,
                notes = f.notes.ifBlank { null },
                photoFrontPath = f.photoFrontPath,
                photoSidePath = f.photoSidePath,
            )
            submitCheckInUseCase(checkIn)
                .onSuccess { saved ->
                    Napier.i("check-in submitted", tag = TAG)
                    _state.update { it.copy(isSubmitting = false, submitted = true, history = listOf(saved) + it.history.filter { h -> h.id != saved.id }) }
                }
                .onFailure { e ->
                    Napier.e("submit failed", e, tag = TAG)
                    _state.update { it.copy(isSubmitting = false, error = e.message ?: "Check-in submission failed") }
                }
        }
    }

    private fun CheckIn.toForm() = CheckInForm(
        weightKg = weightKg?.toString() ?: "",
        energyLevel = energyLevel,
        sleepQuality = sleepQuality,
        stressLevel = stressLevel,
        trainingAdherence = trainingAdherence?.toString() ?: "",
        nutritionAdherence = nutritionAdherence,
        notes = notes ?: "",
        photoFrontPath = photoFrontPath,
        photoSidePath = photoSidePath,
    )

    private fun currentWeekMonday(): LocalDate {
        var d = todayDate()
        while (d.dayOfWeek != DayOfWeek.MONDAY) d = d.minus(1, DateTimeUnit.DAY)
        return d
    }
}
