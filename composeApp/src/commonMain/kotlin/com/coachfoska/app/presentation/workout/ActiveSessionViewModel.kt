package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.CheckPersonalRecordUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExerciseByIdUseCase
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
    private val workoutRepository: WorkoutRepository,
    private val getExerciseByIdUseCase: GetExerciseByIdUseCase,
    private val userId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ActiveSessionState())
    val state: StateFlow<ActiveSessionState> = _state.asStateFlow()

    private var timerJob: Job? = null

    fun onIntent(intent: ActiveSessionIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            is ActiveSessionIntent.InitSession -> initSession(intent.workoutId, intent.resumeLogId)
            is ActiveSessionIntent.SwitchExercise -> switchExercise(intent.index)
            is ActiveSessionIntent.UpdateSetActual -> updateSet(intent)
            is ActiveSessionIntent.MarkSetComplete -> markSetComplete(intent)
            is ActiveSessionIntent.AddExtraSet -> addExtraSet(intent.exerciseIndex)
            is ActiveSessionIntent.RemoveSet -> removeSet(intent.exerciseIndex, intent.setIndex)
            is ActiveSessionIntent.SkipToNextExercise -> skipToNextExercise(intent.exerciseIndex)
            is ActiveSessionIntent.AddExerciseNote -> addNote(intent.exerciseIndex, intent.note)
            is ActiveSessionIntent.StartRestTimer -> startTimer(intent.seconds)
            ActiveSessionIntent.SkipRestTimer -> skipTimer()
            is ActiveSessionIntent.AdjustRestTimer -> adjustTimer(intent.deltaSeconds)
            ActiveSessionIntent.DismissPRBanner -> _state.update { it.copy(activePRBanner = null) }
            is ActiveSessionIntent.SubmitSession -> submitSession(intent.notes)
            is ActiveSessionIntent.RetrySetSave -> retrySetSave(intent.exerciseIndex, intent.setIndex)
            ActiveSessionIntent.DiscardSession -> discardSession()
            ActiveSessionIntent.DismissError -> _state.update { it.copy(error = null) }
            is ActiveSessionIntent.SubstituteExercise -> substituteExercise(intent)
            ActiveSessionIntent.DismissSubstitution -> _state.update { it.copy(lastSubstitution = null) }
            is ActiveSessionIntent.RenameSession -> renameSession(intent.name)
            is ActiveSessionIntent.ChangeSetType -> changeSetType(intent.exerciseIndex, intent.setIndex, intent.setType)
        }
    }

    private fun initSession(workoutId: String, resumeLogId: String? = null) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            if (resumeLogId != null) {
                resumeSession(resumeLogId)
                return@launch
            }
            getWorkoutByIdUseCase(workoutId).onSuccess { workout ->
                val draft = enrichExerciseMedia(workout.toDraft(currentInstant().toEpochMilliseconds()))
                _state.update {
                    it.copy(
                        sessionDraft = draft,
                        sessionStartTime = draft.startTime,
                        isLoading = false,
                    )
                }
                workoutRepository.startWorkoutSession(userId, workout.id, workout.name)
                    .onSuccess { logId ->
                        _state.update { s ->
                            s.copy(
                                sessionDraft = s.sessionDraft?.copy(workoutLogId = logId),
                                sessionSaveDegraded = false,
                            )
                        }
                    }
                    .onFailure { e ->
                        Napier.e("Failed to start live session; falling back to bulk submit", e, tag = TAG)
                        _state.update { s -> s.copy(sessionSaveDegraded = true) }
                    }
                loadPreviousData(draft.exercises.map { it.exerciseName })
            }.onFailure { e ->
                _state.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    private suspend fun resumeSession(resumeLogId: String) {
        workoutRepository.getInProgressSession(userId).onSuccess { log ->
            if (log == null || log.id != resumeLogId) {
                _state.update { it.copy(error = "Workout session not found.", isLoading = false) }
                return
            }
            val baseDraft = log.workoutId
                ?.let { id -> getWorkoutByIdUseCase(id).getOrNull()?.toDraft(log.loggedAt.toEpochMilliseconds()) }
            val draft = enrichExerciseMedia(rebuildDraftFromLog(log, baseDraft))
            _state.update {
                it.copy(
                    sessionDraft = draft,
                    sessionStartTime = draft.startTime,
                    isLoading = false,
                    sessionSaveDegraded = false,
                )
            }
            loadPreviousData(draft.exercises.map { it.exerciseName })
        }.onFailure { e ->
            _state.update { it.copy(error = e.message, isLoading = false) }
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

            persistSet(intent.exerciseIndex, intent.setIndex)
            checkAutoAdvance(intent.exerciseIndex)
        } else {
            val set = _state.value.sessionDraft
                ?.exercises
                ?.getOrNull(intent.exerciseIndex)
                ?.sets
                ?.getOrNull(intent.setIndex)
            if (set?.setLogId != null) persistSet(intent.exerciseIndex, intent.setIndex)
        }
    }

    private fun retrySetSave(exerciseIndex: Int, setIndex: Int) {
        persistSet(exerciseIndex, setIndex)
    }

    private fun persistSet(exerciseIndex: Int, setIndex: Int) {
        val draft = _state.value.sessionDraft ?: return
        val workoutLogId = draft.workoutLogId
        if (workoutLogId == null) {
            _state.update { it.copy(sessionSaveDegraded = true) }
            return
        }
        val exercise = draft.exercises.getOrNull(exerciseIndex) ?: return
        val set = exercise.sets.getOrNull(setIndex) ?: return

        setSetSaveState(exerciseIndex, setIndex, SetSaveState.Saving)

        viewModelScope.launch {
            val setLog = set.toSetLog(exercise.exerciseLogId.orEmpty())
            val result = if (set.setLogId == null) {
                workoutRepository.saveSetLog(
                    workoutLogId = workoutLogId,
                    exerciseName = exercise.exerciseName,
                    exerciseId = exercise.exerciseId,
                    substitutedFromExerciseId = exercise.substitutedFromExerciseId,
                    substitutedFromName = exercise.substitutedFromName,
                    existingExerciseLogId = exercise.exerciseLogId,
                    set = setLog,
                ).map { ref ->
                    _state.update { s ->
                        val d = s.sessionDraft ?: return@update s
                        val exercises = d.exercises.toMutableList()
                        val ex = exercises[exerciseIndex]
                        val sets = ex.sets.toMutableList()
                        sets[setIndex] = sets[setIndex].copy(
                            setLogId = ref.setLogId,
                            saveState = SetSaveState.Saved,
                        )
                        exercises[exerciseIndex] = ex.copy(exerciseLogId = ref.exerciseLogId, sets = sets)
                        s.copy(sessionDraft = d.copy(exercises = exercises))
                    }
                }
            } else {
                workoutRepository.updateSetLog(
                    setLogId = set.setLogId,
                    set = set.copy(saveState = SetSaveState.Saving).toSetLog(exercise.exerciseLogId.orEmpty()),
                ).map {
                    setSetSaveState(exerciseIndex, setIndex, SetSaveState.Saved)
                }
            }

            result.onFailure { e ->
                Napier.e("Failed to autosave set", e, tag = TAG)
                setSetSaveState(exerciseIndex, setIndex, SetSaveState.Failed)
            }
        }
    }

    private fun setSetSaveState(exerciseIndex: Int, setIndex: Int, saveState: SetSaveState) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val exercises = draft.exercises.toMutableList()
            val exercise = exercises.getOrNull(exerciseIndex) ?: return@update s
            val sets = exercise.sets.toMutableList()
            val set = sets.getOrNull(setIndex) ?: return@update s
            sets[setIndex] = set.copy(saveState = saveState)
            exercises[exerciseIndex] = exercise.copy(sets = sets)
            s.copy(sessionDraft = draft.copy(exercises = exercises))
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
            val nextIncomplete = nextIncompleteExerciseIndex(draft, exerciseIndex)
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
        val setLogId = _state.value.sessionDraft
            ?.exercises
            ?.getOrNull(exIndex)
            ?.sets
            ?.getOrNull(setIndex)
            ?.setLogId

        if (setLogId != null) {
            viewModelScope.launch {
                workoutRepository.deleteSetLog(setLogId)
                    .onSuccess { removeSetLocally(exIndex, setIndex) }
                    .onFailure { e ->
                        Napier.e("Failed to delete set log", e, tag = TAG)
                        _state.update { it.copy(error = e.message) }
                    }
            }
            return
        }

        removeSetLocally(exIndex, setIndex)
    }

    private fun removeSetLocally(exIndex: Int, setIndex: Int) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx.getOrNull(exIndex) ?: return@update s
            if (ex.sets.size <= 1) return@update s
            if (setIndex !in ex.sets.indices) return@update s
            val updatedSets = ex.sets.toMutableList().apply { removeAt(setIndex) }
                .mapIndexed { i, set -> set.copy(sortOrder = i + 1) }
            updatedEx[exIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun skipToNextExercise(exerciseIndex: Int) {
        val draft = _state.value.sessionDraft ?: return
        val nextIndex = nextIncompleteExerciseIndex(draft, exerciseIndex)
        if (nextIndex >= 0 && nextIndex != exerciseIndex) {
            _state.update { it.copy(currentExerciseIndex = nextIndex) }
        }
    }

    private fun nextIncompleteExerciseIndex(draft: SessionDraft, exerciseIndex: Int): Int {
        val afterCurrent = ((exerciseIndex + 1)..draft.exercises.lastIndex)
            .firstOrNull { index -> draft.exercises[index].sets.any { !it.completed } }
        if (afterCurrent != null) return afterCurrent
        return (0 until exerciseIndex)
            .firstOrNull { index -> draft.exercises[index].sets.any { !it.completed } }
            ?: -1
    }

    private fun addNote(exIndex: Int, note: String) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            updatedEx[exIndex] = updatedEx[exIndex].copy(tips = note)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun renameSession(name: String) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            s.copy(sessionDraft = draft.copy(workoutName = name))
        }
    }

    private fun changeSetType(exerciseIndex: Int, setIndex: Int, setType: SetType) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx.getOrNull(exerciseIndex) ?: return@update s
            val updatedSets = ex.sets.toMutableList()
            val set = updatedSets.getOrNull(setIndex) ?: return@update s
            updatedSets[setIndex] = set.copy(setType = setType)
            updatedEx[exerciseIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun substituteExercise(intent: ActiveSessionIntent.SubstituteExercise) {
        val draft = _state.value.sessionDraft ?: return
        val index = intent.exerciseIndex
        if (index !in draft.exercises.indices) return

        val old = draft.exercises[index]
        val replacement = intent.replacement

        // First-origin wins: if already substituted, keep original lineage.
        val originId = old.substitutedFromExerciseId ?: old.exerciseId
        val originName = old.substitutedFromName ?: old.exerciseName

        val updatedEx = draft.exercises.toMutableList()
        updatedEx[index] = old.copy(
            exerciseName = replacement.name,
            exerciseId = replacement.id,
            imageUrl = replacement.imageUrl,
            imageUrl2 = replacement.imageUrl2,
            videoUrl = replacement.videoUrl,
            substitutedFromExerciseId = originId,
            substitutedFromName = originName,
        )
        _state.update { s ->
            s.copy(
                sessionDraft = draft.copy(exercises = updatedEx),
                lastSubstitution = Pair(old.exerciseName, replacement.name),
            )
        }
        // Reload prefill for new exercise name
        viewModelScope.launch {
            getPreviousLogsUseCase(userId, listOf(replacement.name)).onSuccess { data ->
                _state.update { it.copy(previousData = it.previousData + data) }
            }
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
                    exerciseId = ex.exerciseId,
                    substitutedFromExerciseId = ex.substitutedFromExerciseId,
                    substitutedFromName = ex.substitutedFromName,
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
            if (draft.workoutLogId != null) {
                workoutRepository.finishWorkoutSession(draft.workoutLogId, durationMinutes, notes)
                    .onSuccess {
                        _state.update { it.copy(isSubmitting = false, submittedLogId = draft.workoutLogId) }
                    }
                    .onFailure { e ->
                        _state.update { it.copy(isSubmitting = false, error = e.message) }
                    }
                return@launch
            }
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

    private fun discardSession() {
        val workoutLogId = _state.value.sessionDraft?.workoutLogId
        viewModelScope.launch {
            if (workoutLogId == null) {
                _state.update { it.copy(sessionDiscarded = true) }
                return@launch
            }
            workoutRepository.discardWorkoutSession(workoutLogId)
                .onSuccess { _state.update { it.copy(sessionDiscarded = true) } }
                .onFailure { e -> _state.update { it.copy(error = e.message) } }
        }
    }

    private fun rebuildDraftFromLog(log: WorkoutLog, baseDraft: SessionDraft?): SessionDraft {
        val loggedByName = log.exerciseLogs.associateBy { it.exerciseName }
        val exercises = if (baseDraft != null) {
            baseDraft.exercises.map { base ->
                val logged = loggedByName[base.exerciseName] ?: return@map base
                base.copy(
                    exerciseLogId = logged.id,
                    sets = mergeLoggedSets(base.sets, logged.sets),
                )
            }
        } else {
            log.exerciseLogs.map { logged ->
                ExerciseDraft(
                    exerciseName = logged.exerciseName,
                    exerciseId = logged.exerciseId,
                    exerciseLogId = logged.id,
                    videoUrl = logged.videoUrl,
                    substitutedFromExerciseId = logged.substitutedFromExerciseId,
                    substitutedFromName = logged.substitutedFromName,
                    sets = logged.sets.sortedBy { it.sortOrder }.map { it.toDraft() },
                )
            }
        }
        return SessionDraft(
            workoutId = log.workoutId,
            workoutName = log.workoutName,
            startTime = log.loggedAt.toEpochMilliseconds(),
            workoutLogId = log.id,
            notes = log.notes,
            exercises = exercises,
        )
    }

    private suspend fun enrichExerciseMedia(draft: SessionDraft): SessionDraft {
        val cache = mutableMapOf<String, com.coachfoska.app.domain.model.Exercise?>()
        val exercises = draft.exercises.map { exercise ->
            val exerciseId = exercise.exerciseId ?: return@map exercise
            val domainExercise = cache.getOrPut(exerciseId) {
                getExerciseByIdUseCase(exerciseId)
                    .onFailure { Napier.w("Failed to enrich exercise media for $exerciseId: ${it.message}", tag = TAG) }
                    .getOrNull()
            } ?: return@map exercise
            exercise.copy(
                imageUrl = exercise.imageUrl ?: domainExercise.imageUrl,
                imageUrl2 = exercise.imageUrl2 ?: domainExercise.imageUrl2,
                videoUrl = exercise.videoUrl ?: domainExercise.videoUrl,
            )
        }
        return draft.copy(exercises = exercises)
    }

    private fun mergeLoggedSets(baseSets: List<SetDraft>, loggedSets: List<SetLog>): List<SetDraft> {
        val loggedByOrder = loggedSets.associateBy { it.sortOrder }
        return baseSets.map { base ->
            loggedByOrder[base.sortOrder]?.toDraft(base) ?: base
        }
    }

    private fun SetDraft.toSetLog(exerciseLogId: String): SetLog = SetLog(
        id = setLogId.orEmpty(),
        exerciseLogId = exerciseLogId,
        sortOrder = sortOrder,
        targetReps = targetReps,
        actualReps = actualReps,
        targetWeightKg = targetWeightKg,
        actualWeightKg = actualWeightKg,
        rpe = rpe,
        targetRestSeconds = targetRestSeconds,
        actualRestSeconds = actualRestSeconds,
        completed = completed,
    )

    private fun SetLog.toDraft(base: SetDraft? = null): SetDraft = SetDraft(
        sortOrder = sortOrder,
        targetReps = targetReps ?: base?.targetReps,
        actualReps = actualReps,
        targetWeightKg = targetWeightKg ?: base?.targetWeightKg,
        actualWeightKg = actualWeightKg,
        rpe = rpe,
        targetRestSeconds = targetRestSeconds ?: base?.targetRestSeconds,
        actualRestSeconds = actualRestSeconds,
        completed = completed,
        setLogId = id,
        saveState = SetSaveState.Saved,
    )

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}
