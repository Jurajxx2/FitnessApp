package com.coachfoska.app.presentation.checkin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.core.util.currentCheckInWeekMonday
import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.domain.usecase.checkin.GetCheckInHistoryUseCase
import com.coachfoska.app.domain.usecase.checkin.GetCurrentWeekCheckInUseCase
import com.coachfoska.app.domain.usecase.checkin.SubmitCheckInUseCase
import com.coachfoska.app.domain.usecase.checkin.UploadCheckInPhotoUseCase
import com.coachfoska.app.domain.usecase.checkin.RemoveCheckInPhotosUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate

class CheckInViewModel(
    private val submitCheckInUseCase: SubmitCheckInUseCase,
    private val getCheckInHistoryUseCase: GetCheckInHistoryUseCase,
    private val getCurrentWeekCheckInUseCase: GetCurrentWeekCheckInUseCase,
    private val uploadCheckInPhotoUseCase: UploadCheckInPhotoUseCase,
    private val removeCheckInPhotosUseCase: RemoveCheckInPhotosUseCase,
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val userId: String,
    private val prefillExisting: Boolean = true,
) : ViewModel() {

    private companion object { const val TAG = "CheckInViewModel" }

    private val _state = MutableStateFlow(CheckInState())
    val state: StateFlow<CheckInState> = _state.asStateFlow()

    private val weekOf: LocalDate = currentCheckInWeekMonday()
    private val pendingPhotos = mutableMapOf<String, ByteArray>()

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
            is CheckInIntent.PhotoPicked -> selectPhoto(intent.slot, intent.bytes)
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
            if (prefillExisting) {
                // Existing draft for this week, else prefill weight from profile.
                val existing = getCurrentWeekCheckInUseCase(userId, weekOf).getOrNull()
                if (existing != null) {
                    _state.update { it.copy(form = existing.toForm()) }
                } else {
                    getUserProfileUseCase(userId).onSuccess { user ->
                        user.weightKg?.let { w -> updateForm { f -> f.copy(weightKg = w.toString()) } }
                    }
                }
            }
            _state.update { it.copy(isLoading = false) }
        }
    }

    private fun selectPhoto(slot: String, bytes: ByteArray) {
        if (slot !in setOf("front", "side") || bytes.isEmpty()) return
        pendingPhotos[slot] = bytes.copyOf()
        _state.update { it.copy(selectedPhotoSlots = pendingPhotos.keys.toSet(), error = null) }
    }

    private fun submit() {
        if (_state.value.isSubmitting) return
        viewModelScope.launch {
            _state.update { it.copy(isSubmitting = true, error = null) }
            val f = _state.value.form
            val cleanupPaths = mutableListOf<String>()
            try {
                var frontPath = f.photoFrontPath
                var sidePath = f.photoSidePath
                for (slot in listOf("front", "side")) {
                    val bytes = pendingPhotos[slot] ?: continue
                    val path = uploadCheckInPhotoUseCase(userId, weekOf, slot, bytes).getOrThrow()
                    val existingPath = if (slot == "front") f.photoFrontPath else f.photoSidePath
                    if (existingPath != path) cleanupPaths += path
                    if (slot == "front") frontPath = path else sidePath = path
                }
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
                    photoFrontPath = frontPath,
                    photoSidePath = sidePath,
                )
                val saved = submitCheckInUseCase(checkIn).getOrThrow()
                pendingPhotos.clear()
                Napier.i("check-in submitted", tag = TAG)
                _state.update {
                    it.copy(
                        isSubmitting = false,
                        submitted = true,
                        selectedPhotoSlots = emptySet(),
                        history = listOf(saved) + it.history.filter { historyItem -> historyItem.id != saved.id },
                    )
                }
            } catch (error: Throwable) {
                if (cleanupPaths.isNotEmpty()) {
                    removeCheckInPhotosUseCase(cleanupPaths).onFailure { cleanupError ->
                        Napier.e("check-in photo cleanup failed", cleanupError, tag = TAG)
                    }
                }
                Napier.e("submit failed", error, tag = TAG)
                _state.update {
                    it.copy(isSubmitting = false, error = error.message ?: "Check-in submission failed")
                }
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
}
