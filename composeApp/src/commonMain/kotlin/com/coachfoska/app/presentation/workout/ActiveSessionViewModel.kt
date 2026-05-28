package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.usecase.workout.CheckPersonalRecordUseCase
import com.coachfoska.app.domain.usecase.workout.GetPreviousExerciseLogsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.core.util.currentInstant
import io.github.aakira.napier.Napier
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ActiveSessionVM"

class ActiveSessionViewModel(
    private val getWorkoutByIdUseCase: GetWorkoutByIdUseCase,
    private val logWorkoutUseCase: LogWorkoutUseCase,
    private val getPreviousLogsUseCase: GetPreviousExerciseLogsUseCase,
    private val checkPRUseCase: CheckPersonalRecordUseCase,
    private val userId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ActiveSessionState())
    val state: StateFlow<ActiveSessionState> = _state.asStateFlow()

    private var timerJob: Job? = null

    fun onIntent(intent: ActiveSessionIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            is ActiveSessionIntent.InitSession -> initSession(intent.workoutId)
            is ActiveSessionIntent.SwitchExercise -> switchExercise(intent.index)
            is ActiveSessionIntent.UpdateSetActual -> updateSet(intent)
            is ActiveSessionIntent.MarkSetComplete -> markSetComplete(intent)
            is ActiveSessionIntent.AddExtraSet -> addExtraSet(intent.exerciseIndex)
            is ActiveSessionIntent.RemoveSet -> removeSet(intent.exerciseIndex, intent.setIndex)
            is ActiveSessionIntent.AddExerciseNote -> addNote(intent.exerciseIndex, intent.note)
            is ActiveSessionIntent.StartRestTimer -> startTimer(intent.seconds)
            ActiveSessionIntent.SkipRestTimer -> skipTimer()
            is ActiveSessionIntent.AdjustRestTimer -> adjustTimer(intent.deltaSeconds)
            ActiveSessionIntent.DismissPRBanner -> _state.update { it.copy(activePRBanner = null) }
            is ActiveSessionIntent.SubmitSession -> submitSession(intent.notes)
            ActiveSessionIntent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun initSession(workoutId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getWorkoutByIdUseCase(workoutId).onSuccess { workout ->
                val draft = workout.toDraft(currentInstant().toEpochMilliseconds())
                _state.update {
                    it.copy(
                        sessionDraft = draft,
                        sessionStartTime = draft.startTime,
                        isLoading = false,
                    )
                }
                loadPreviousData(draft.exercises.map { it.exerciseName })
            }.onFailure { e ->
                _state.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    private fun loadPreviousData(exerciseNames: List<String>) {
        viewModelScope.launch {
            getPreviousLogsUseCase(userId, exerciseNames).onSuccess { data ->
                _state.update { it.copy(previousData = data) }
            }.onFailure { e ->
                Napier.e("Failed to load PREVIOUS data", e, tag = TAG)
            }
        }
    }

    private fun switchExercise(index: Int) {
        val draft = _state.value.sessionDraft ?: return
        if (index in draft.exercises.indices) {
            _state.update { it.copy(currentExerciseIndex = index) }
        }
    }

    private fun updateSet(intent: ActiveSessionIntent.UpdateSetActual) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[intent.exerciseIndex]
            val updatedSets = ex.sets.toMutableList()
            updatedSets[intent.setIndex] = updatedSets[intent.setIndex].copy(
                actualReps = intent.reps,
                actualWeightKg = intent.weight,
            )
            updatedEx[intent.exerciseIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun markSetComplete(intent: ActiveSessionIntent.MarkSetComplete) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[intent.exerciseIndex]
            val updatedSets = ex.sets.toMutableList()
            updatedSets[intent.setIndex] = updatedSets[intent.setIndex].copy(completed = intent.completed)
            updatedEx[intent.exerciseIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }

        if (intent.completed) {
            val draft = _state.value.sessionDraft ?: return
            val set = draft.exercises[intent.exerciseIndex].sets[intent.setIndex]
            val weight = set.actualWeightKg
            val reps = set.actualReps
            val restSeconds = set.targetRestSeconds

            if (restSeconds != null && restSeconds > 0) {
                val exerciseSets = draft.exercises[intent.exerciseIndex].sets
                val hasUncompletedSets = exerciseSets.any { !it.completed && it.sortOrder > set.sortOrder }
                if (hasUncompletedSets) {
                    startTimer(restSeconds)
                }
            }

            // Auto-fill next set weight
            if (weight != null) {
                val nextSetIndex = intent.setIndex + 1
                val exerciseSets = draft.exercises[intent.exerciseIndex].sets
                if (nextSetIndex < exerciseSets.size && !exerciseSets[nextSetIndex].completed) {
                    val nextSet = exerciseSets[nextSetIndex]
                    if (nextSet.actualWeightKg == null) {
                        _state.update { s ->
                            val d = s.sessionDraft ?: return@update s
                            val exList = d.exercises.toMutableList()
                            val currentEx = exList[intent.exerciseIndex]
                            val setsList = currentEx.sets.toMutableList()
                            setsList[nextSetIndex] = setsList[nextSetIndex].copy(actualWeightKg = weight)
                            exList[intent.exerciseIndex] = currentEx.copy(sets = setsList)
                            s.copy(sessionDraft = d.copy(exercises = exList))
                        }
                    }
                }
            }

            // Check for PR
            if (weight != null && reps != null && weight > 0f && reps > 0) {
                checkForPR(draft.exercises[intent.exerciseIndex].exerciseName, weight, reps)
            }

            checkAutoAdvance(intent.exerciseIndex)
        }
    }

    private fun checkForPR(exerciseName: String, weight: Float, reps: Int) {
        viewModelScope.launch {
            val pr = checkPRUseCase(userId, exerciseName, weight, reps)
            if (pr != null) {
                _state.update { s ->
                    s.copy(
                        sessionPRs = s.sessionPRs + pr,
                        activePRBanner = pr,
                    )
                }
                delay(3000)
                _state.update { it.copy(activePRBanner = null) }
            }
        }
    }

    private fun checkAutoAdvance(exerciseIndex: Int) {
        val draft = _state.value.sessionDraft ?: return
        val exercise = draft.exercises[exerciseIndex]
        if (exercise.sets.all { it.completed }) {
            val nextIncomplete = draft.exercises.indexOfFirst { ex ->
                ex.sets.any { !it.completed }
            }
            if (nextIncomplete >= 0 && nextIncomplete != exerciseIndex) {
                viewModelScope.launch {
                    delay(1000)
                    _state.update { it.copy(currentExerciseIndex = nextIncomplete) }
                }
            }
        }
    }

    private fun addExtraSet(exIndex: Int) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[exIndex]
            val lastSet = ex.sets.lastOrNull()
            val newSet = SetDraft(
                sortOrder = (lastSet?.sortOrder ?: 0) + 1,
                targetReps = lastSet?.targetReps,
                actualReps = null,
                targetWeightKg = lastSet?.targetWeightKg,
                actualWeightKg = lastSet?.actualWeightKg,
                rpe = null,
                targetRestSeconds = lastSet?.targetRestSeconds,
                actualRestSeconds = null,
            )
            updatedEx[exIndex] = ex.copy(sets = ex.sets + newSet)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun removeSet(exIndex: Int, setIndex: Int) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[exIndex]
            if (ex.sets.size <= 1) return@update s
            val updatedSets = ex.sets.toMutableList().apply { removeAt(setIndex) }
                .mapIndexed { i, set -> set.copy(sortOrder = i + 1) }
            updatedEx[exIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun addNote(exIndex: Int, note: String) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            updatedEx[exIndex] = updatedEx[exIndex].copy(tips = note)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun startTimer(seconds: Int) {
        timerJob?.cancel()
        _state.update {
            it.copy(restTimer = RestTimerState(isActive = true, remainingSeconds = seconds, totalSeconds = seconds))
        }
        timerJob = viewModelScope.launch {
            while (_state.value.restTimer.remainingSeconds > 0) {
                delay(1000)
                _state.update { s ->
                    val remaining = (s.restTimer.remainingSeconds - 1).coerceAtLeast(0)
                    s.copy(restTimer = s.restTimer.copy(remainingSeconds = remaining))
                }
            }
            _state.update { it.copy(restTimer = RestTimerState()) }
        }
    }

    private fun skipTimer() {
        timerJob?.cancel()
        _state.update { it.copy(restTimer = RestTimerState()) }
    }

    private fun adjustTimer(delta: Int) {
        _state.update { s ->
            val newRemaining = (s.restTimer.remainingSeconds + delta).coerceAtLeast(0)
            val newTotal = (s.restTimer.totalSeconds + delta).coerceAtLeast(0)
            s.copy(restTimer = s.restTimer.copy(remainingSeconds = newRemaining, totalSeconds = newTotal))
        }
    }

    private fun submitSession(notes: String?) {
        val draft = _state.value.sessionDraft ?: return

        val exerciseLogs = draft.exercises
            .filter { ex -> ex.sets.any { it.completed } }
            .map { ex ->
                ExerciseLog(
                    id = "", workoutLogId = "",
                    exerciseName = ex.exerciseName, notes = null,
                    videoUrl = ex.videoUrl,
                    sets = ex.sets.filter { it.completed }.map { s ->
                        SetLog(
                            id = "", exerciseLogId = "", sortOrder = s.sortOrder,
                            targetReps = s.targetReps, actualReps = s.actualReps,
                            targetWeightKg = s.targetWeightKg, actualWeightKg = s.actualWeightKg,
                            rpe = s.rpe, targetRestSeconds = s.targetRestSeconds,
                            actualRestSeconds = s.actualRestSeconds, completed = true,
                        )
                    }
                )
            }

        if (exerciseLogs.isEmpty()) {
            _state.update { it.copy(error = "No completed sets to save.") }
            return
        }

        val durationMinutes = ((currentInstant().toEpochMilliseconds() - draft.startTime) / 60_000)
            .toInt().coerceAtLeast(1)

        viewModelScope.launch {
            _state.update { it.copy(isSubmitting = true) }
            logWorkoutUseCase(
                userId, draft.workoutId, draft.workoutName,
                durationMinutes, notes, exerciseLogs,
            ).onSuccess { log ->
                _state.update { it.copy(isSubmitting = false, submittedLogId = log.id) }
            }.onFailure { e ->
                _state.update { it.copy(isSubmitting = false, error = e.message) }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}
