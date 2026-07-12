package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.model.inferExerciseLogType
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
            is ActiveSessionIntent.UpdateSetDuration -> updateSetDuration(intent)
            is ActiveSessionIntent.MarkSetComplete -> markSetComplete(intent)
            is ActiveSessionIntent.AddExtraSet -> addExtraSet(intent.exerciseIndex)
            is ActiveSessionIntent.RemoveSet -> removeSet(intent.exerciseIndex, intent.setIndex)
            is ActiveSessionIntent.SkipToNextExercise -> skipToNextExercise(intent.exerciseIndex)
            is ActiveSessionIntent.AddExerciseNote -> addNote(intent.exerciseIndex, intent.note)
            is ActiveSessionIntent.StartRestTimer -> startTimer(
                seconds = intent.seconds,
                exerciseIndex = intent.exerciseIndex,
                setIndex = intent.setIndex,
            )
            ActiveSessionIntent.SkipRestTimer -> skipTimer()
            is ActiveSessionIntent.AdjustRestTimer -> adjustTimer(intent.deltaSeconds)
            ActiveSessionIntent.DismissPRBanner -> _state.update { it.copy(activePRBanner = null) }
            is ActiveSessionIntent.SubmitSession -> submitSession(intent.notes)
            is ActiveSessionIntent.RetrySetSave -> retrySetSave(intent.exerciseIndex, intent.setIndex)
            ActiveSessionIntent.DiscardSession -> discardSession()
            ActiveSessionIntent.DismissError -> _state.update { it.copy(error = null) }
            is ActiveSessionIntent.AddExercise -> addExercise(intent.exercise)
            is ActiveSessionIntent.MoveExercise -> moveExercise(intent.exerciseIndex, intent.direction)
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
                        if (_state.value.sessionDiscarded || _state.value.submittedLogId != null) {
                            workoutRepository.discardWorkoutSession(logId)
                                .onFailure { e -> Napier.e("Failed to discard obsolete live session", e, tag = TAG) }
                            return@onSuccess
                        }
                        _state.update { s ->
                            s.copy(
                                sessionDraft = s.sessionDraft?.copy(workoutLogId = logId),
                                sessionSaveDegraded = false,
                            )
                        }
                        // A user can complete a set before the live workout row has been
                        // created. Flush those local completions now instead of silently
                        // finishing a session without any set statistics.
                        persistCompletedSets()
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
                _state.update { s ->
                    val draft = s.sessionDraft ?: return@update s.copy(previousData = data)
                    s.copy(previousData = data, sessionDraft = draft.copy(exercises = prefillWeights(draft.exercises, data)))
                }
            }.onFailure { e ->
                Napier.e("Failed to load PREVIOUS data", e, tag = TAG)
            }
        }
    }

    /**
     * Seeds each not-yet-completed set's weight with what the user lifted last time (matched by
     * position), so they rarely have to type a number. Only fills sets whose weight is still empty,
     * never overwriting anything the user has already entered.
     */
    private fun prefillWeights(
        exercises: List<ExerciseDraft>,
        previousData: Map<String, List<SetLog>>,
    ): List<ExerciseDraft> = exercises.map { ex ->
        if (ex.logType != ExerciseLogType.WEIGHT_REPS) return@map ex
        val previousSets = previousData[ex.exerciseName].orEmpty()
        if (previousSets.isEmpty()) return@map ex
        val sets = ex.sets.mapIndexed { index, set ->
            val previousWeight = previousSets.getOrNull(index)?.actualWeightKg
            if (set.completed || set.actualWeightKg != null || previousWeight == null) set
            else set.copy(actualWeightKg = previousWeight)
        }
        ex.copy(sets = sets)
    }

    private fun switchExercise(index: Int) {
        val draft = _state.value.sessionDraft ?: return
        if (index in draft.exercises.indices) {
            _state.update { it.copy(currentExerciseIndex = index) }
        }
    }

    private fun updateSet(intent: ActiveSessionIntent.UpdateSetActual) {
        var shouldPersist = false
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx.getOrNull(intent.exerciseIndex) ?: return@update s
            val updatedSets = ex.sets.toMutableList()
            val set = updatedSets.getOrNull(intent.setIndex) ?: return@update s
            updatedSets[intent.setIndex] = set.copy(
                actualReps = intent.reps,
                actualWeightKg = intent.weight,
            )
            updatedEx[intent.exerciseIndex] = ex.copy(sets = updatedSets)
            // Only re-persist a set that already has a row. If the completion insert is still in
            // flight (setLogId == null) a second persist would issue a duplicate INSERT; its success
            // handler re-checks the latest draft via persistSetIfChangedSince and flushes this edit.
            shouldPersist = set.completed && set.setLogId != null
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
        if (shouldPersist) persistSet(intent.exerciseIndex, intent.setIndex)
    }

    private fun updateSetDuration(intent: ActiveSessionIntent.UpdateSetDuration) {
        var shouldPersist = false
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx.getOrNull(intent.exerciseIndex) ?: return@update s
            val updatedSets = ex.sets.toMutableList()
            val set = updatedSets.getOrNull(intent.setIndex) ?: return@update s
            updatedSets[intent.setIndex] = set.copy(actualDurationSeconds = intent.durationSeconds)
            updatedEx[intent.exerciseIndex] = ex.copy(sets = updatedSets)
            // See updateSet: skip while the completion insert is in flight to avoid a duplicate row.
            shouldPersist = set.completed && set.setLogId != null
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
        if (shouldPersist) persistSet(intent.exerciseIndex, intent.setIndex)
    }

    private fun markSetComplete(intent: ActiveSessionIntent.MarkSetComplete) {
        val originalSet = _state.value.sessionDraft
            ?.exercises
            ?.getOrNull(intent.exerciseIndex)
            ?.sets
            ?.getOrNull(intent.setIndex)
            ?: return

        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx.getOrNull(intent.exerciseIndex) ?: return@update s
            val updatedSets = ex.sets.toMutableList()
            val set = updatedSets.getOrNull(intent.setIndex) ?: return@update s
            updatedSets[intent.setIndex] = set.copy(
                completed = intent.completed,
                actualRestSeconds = if (intent.completed) set.actualRestSeconds else null,
            )
            updatedEx[intent.exerciseIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }

        if (intent.completed) {
            val draft = _state.value.sessionDraft ?: return
            val set = draft.exercises.getOrNull(intent.exerciseIndex)
                ?.sets
                ?.getOrNull(intent.setIndex)
                ?: return
            val weight = set.actualWeightKg
            val reps = set.actualReps
            val restSeconds = set.targetRestSeconds

            if (restSeconds != null && restSeconds > 0) {
                val exerciseSets = draft.exercises[intent.exerciseIndex].sets
                val hasUncompletedSets = exerciseSets.any { !it.completed && it.sortOrder > set.sortOrder }
                if (hasUncompletedSets) {
                    startTimer(restSeconds, intent.exerciseIndex, intent.setIndex)
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
            if (
                _state.value.restTimer.exerciseIndex == intent.exerciseIndex &&
                _state.value.restTimer.setIndex == intent.setIndex
            ) {
                cancelRestTimer(recordElapsedRest = false)
            }
            if (originalSet.setLogId != null) persistSet(intent.exerciseIndex, intent.setIndex)
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

        // Address the set by stable identity (exercise name + set sortOrder), never by the captured
        // indices, inside the async handlers below. The athlete can reorder exercises while this
        // insert/update is in flight, which would otherwise write the returned ids onto the wrong row.
        val exerciseName = exercise.exerciseName
        val sortOrder = set.sortOrder

        setSetSaveState(exerciseName, sortOrder, SetSaveState.Saving)

        viewModelScope.launch {
            val setLog = set.toSetLog(exercise.exerciseLogId.orEmpty())
            if (set.setLogId == null) {
                workoutRepository.saveSetLog(
                    workoutLogId = workoutLogId,
                    exerciseName = exercise.exerciseName,
                    exerciseId = exercise.exerciseId,
                    substitutedFromExerciseId = exercise.substitutedFromExerciseId,
                    substitutedFromName = exercise.substitutedFromName,
                    existingExerciseLogId = exercise.exerciseLogId,
                    set = setLog,
                ).onSuccess { ref ->
                    _state.update { s ->
                        val d = s.sessionDraft ?: return@update s
                        val (ei, si) = d.locateSet(exerciseName, sortOrder) ?: return@update s
                        val exercises = d.exercises.toMutableList()
                        val ex = exercises[ei]
                        val sets = ex.sets.toMutableList()
                        sets[si] = sets[si].copy(
                            setLogId = ref.setLogId,
                            saveState = SetSaveState.Saved,
                        )
                        exercises[ei] = ex.copy(exerciseLogId = ref.exerciseLogId, sets = sets)
                        s.copy(sessionDraft = d.copy(exercises = exercises))
                    }
                    persistSetIfChangedSince(exerciseName, sortOrder, set)
                }.onFailure { e ->
                    Napier.e("Failed to autosave set", e, tag = TAG)
                    setSetSaveState(exerciseName, sortOrder, SetSaveState.Failed)
                }
            } else {
                workoutRepository.updateSetLog(
                    setLogId = set.setLogId,
                    set = set.copy(saveState = SetSaveState.Saving).toSetLog(exercise.exerciseLogId.orEmpty()),
                ).onSuccess {
                    setSetSaveState(exerciseName, sortOrder, SetSaveState.Saved)
                    persistSetIfChangedSince(exerciseName, sortOrder, set)
                }.onFailure { e ->
                    Napier.e("Failed to autosave set", e, tag = TAG)
                    setSetSaveState(exerciseName, sortOrder, SetSaveState.Failed)
                }
            }
        }
    }

    /**
     * A set may be edited while its first insert/update is in flight (most commonly when a rest
     * countdown ends before a slow network response). Re-save the latest values once that request
     * settles so history and all derived statistics use what the athlete actually logged.
     */
    private fun persistSetIfChangedSince(exerciseName: String, sortOrder: Int, persisted: SetDraft) {
        val draft = _state.value.sessionDraft ?: return
        val (exerciseIndex, setIndex) = draft.locateSet(exerciseName, sortOrder) ?: return
        val current = draft.exercises[exerciseIndex].sets[setIndex]
        if (!current.hasSamePersistedValuesAs(persisted)) {
            persistSet(exerciseIndex, setIndex)
        }
    }

    private fun setSetSaveState(exerciseName: String, sortOrder: Int, saveState: SetSaveState) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val (exerciseIndex, setIndex) = draft.locateSet(exerciseName, sortOrder) ?: return@update s
            val exercises = draft.exercises.toMutableList()
            val exercise = exercises[exerciseIndex]
            val sets = exercise.sets.toMutableList()
            sets[setIndex] = sets[setIndex].copy(saveState = saveState)
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

    private fun addExercise(exercise: com.coachfoska.app.domain.model.Exercise) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            s.copy(sessionDraft = draft.copy(exercises = draft.exercises + exercise.toSessionDraft()))
        }
        viewModelScope.launch {
            getPreviousLogsUseCase(userId, listOf(exercise.name)).onSuccess { data ->
                _state.update { it.copy(previousData = it.previousData + data) }
            }
        }
    }

    private fun moveExercise(exerciseIndex: Int, direction: Int) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val targetIndex = exerciseIndex + direction
            if (exerciseIndex !in draft.exercises.indices || targetIndex !in draft.exercises.indices) {
                return@update s
            }
            val exercises = draft.exercises.toMutableList()
            val item = exercises.removeAt(exerciseIndex)
            exercises.add(targetIndex, item)
            val restTimer = when (s.restTimer.exerciseIndex) {
                exerciseIndex -> s.restTimer.copy(exerciseIndex = targetIndex)
                targetIndex -> s.restTimer.copy(exerciseIndex = exerciseIndex)
                else -> s.restTimer
            }
            s.copy(
                sessionDraft = draft.copy(exercises = exercises),
                currentExerciseIndex = targetIndex,
                restTimer = restTimer,
            )
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
            animationUrl = replacement.animationUrl,
            lottieAnimations = replacement.lottieAnimations,
            videoUrl = replacement.videoUrl,
            logType = replacement.logType,
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

    private fun startTimer(seconds: Int, exerciseIndex: Int? = null, setIndex: Int? = null) {
        if (seconds <= 0) return
        cancelRestTimer(recordElapsedRest = true)
        val startedAt = currentInstant().toEpochMilliseconds()
        _state.update {
            it.copy(
                restTimer = RestTimerState(
                    isActive = true,
                    remainingSeconds = seconds,
                    totalSeconds = seconds,
                    exerciseIndex = exerciseIndex,
                    setIndex = setIndex,
                    startedAtEpochMillis = startedAt,
                ),
            )
        }
        timerJob = viewModelScope.launch {
            while (_state.value.restTimer.remainingSeconds > 0) {
                delay(1000)
                _state.update { s ->
                    val timer = s.restTimer
                    if (!timer.isActive) return@update s
                    val elapsedByClock = ((currentInstant().toEpochMilliseconds() - timer.startedAtEpochMillis) / 1_000)
                        .toInt()
                        .coerceAtLeast(0)
                    // The tick count keeps coroutine-test timers deterministic, while the wall
                    // clock catches up after the app has been backgrounded.
                    val elapsedByTicks = timer.totalSeconds - timer.remainingSeconds + 1
                    val elapsed = maxOf(elapsedByClock, elapsedByTicks)
                    val remaining = (timer.totalSeconds - elapsed).coerceAtLeast(0)
                    s.copy(restTimer = timer.copy(remainingSeconds = remaining))
                }
            }
            cancelRestTimer(recordElapsedRest = true)
        }
    }

    private fun skipTimer() {
        cancelRestTimer(recordElapsedRest = true)
    }

    private fun adjustTimer(delta: Int) {
        var shouldFinish = false
        _state.update { s ->
            val timer = s.restTimer
            if (!timer.isActive) return@update s
            val elapsed = (timer.totalSeconds - timer.remainingSeconds).coerceAtLeast(0)
            val newTotal = (timer.totalSeconds + delta).coerceAtLeast(elapsed)
            val newRemaining = (newTotal - elapsed).coerceAtLeast(0)
            shouldFinish = newRemaining == 0
            s.copy(restTimer = timer.copy(remainingSeconds = newRemaining, totalSeconds = newTotal))
        }
        if (shouldFinish) cancelRestTimer(recordElapsedRest = true)
    }

    private fun cancelRestTimer(recordElapsedRest: Boolean) {
        val timer = _state.value.restTimer
        timerJob?.cancel()
        timerJob = null
        if (!timer.isActive) return

        _state.update { it.copy(restTimer = RestTimerState()) }
        if (!recordElapsedRest) return

        val exerciseIndex = timer.exerciseIndex ?: return
        val setIndex = timer.setIndex ?: return
        val elapsed = (timer.totalSeconds - timer.remainingSeconds).coerceAtLeast(0)
        updateSetRestElapsed(exerciseIndex, setIndex, elapsed)
    }

    private fun updateSetRestElapsed(exerciseIndex: Int, setIndex: Int, elapsedSeconds: Int) {
        var shouldPersist = false
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val exercises = draft.exercises.toMutableList()
            val exercise = exercises.getOrNull(exerciseIndex) ?: return@update s
            val sets = exercise.sets.toMutableList()
            val set = sets.getOrNull(setIndex) ?: return@update s
            if (!set.completed) return@update s
            sets[setIndex] = set.copy(actualRestSeconds = elapsedSeconds)
            exercises[exerciseIndex] = exercise.copy(sets = sets)
            // The completion insert may still be in flight. Its success handler compares the
            // latest draft and performs one follow-up update, so issuing another insert here
            // would duplicate a set. A failed insert remains explicitly retryable by the user.
            shouldPersist = set.setLogId != null
            s.copy(sessionDraft = draft.copy(exercises = exercises))
        }
        if (shouldPersist) persistSet(exerciseIndex, setIndex)
    }

    private fun persistCompletedSets() {
        val draft = _state.value.sessionDraft ?: return
        draft.exercises.forEachIndexed { exerciseIndex, exercise ->
            exercise.sets.forEachIndexed { setIndex, set ->
                if (set.completed && set.setLogId == null) {
                    persistSet(exerciseIndex, setIndex)
                }
            }
        }
    }

    private fun submitSession(notes: String?) {
        // Keep a partial final rest interval when the user finishes a workout mid-countdown.
        // This is still useful history and avoids leaving an active timer behind a completed log.
        cancelRestTimer(recordElapsedRest = true)
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
                            actualDurationSeconds = s.actualDurationSeconds,
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
        cancelRestTimer(recordElapsedRest = false)
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
            } + log.exerciseLogs
                .filter { logged -> baseDraft.exercises.none { it.exerciseName == logged.exerciseName } }
                .map { logged ->
                    ExerciseDraft(
                        exerciseName = logged.exerciseName,
                        exerciseId = logged.exerciseId,
                        exerciseLogId = logged.id,
                        videoUrl = logged.videoUrl,
                        logType = inferExerciseLogType(logged.exerciseName),
                        substitutedFromExerciseId = logged.substitutedFromExerciseId,
                        substitutedFromName = logged.substitutedFromName,
                        sets = logged.sets.sortedBy { it.sortOrder }.map { it.toDraft() },
                    )
                }
        } else {
            log.exerciseLogs.map { logged ->
                ExerciseDraft(
                    exerciseName = logged.exerciseName,
                    exerciseId = logged.exerciseId,
                    exerciseLogId = logged.id,
                    videoUrl = logged.videoUrl,
                    logType = inferExerciseLogType(logged.exerciseName),
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
                animationUrl = exercise.animationUrl ?: domainExercise.animationUrl,
                lottieAnimations = domainExercise.lottieAnimations,
                videoUrl = exercise.videoUrl ?: domainExercise.videoUrl,
                logType = domainExercise.logType,
            )
        }
        return draft.copy(exercises = exercises)
    }

    private fun mergeLoggedSets(baseSets: List<SetDraft>, loggedSets: List<SetLog>): List<SetDraft> {
        val loggedByOrder = loggedSets.associateBy { it.sortOrder }
        return baseSets.map { base ->
            loggedByOrder[base.sortOrder]?.toDraft(base) ?: base
        } + loggedSets
            .filter { logged -> baseSets.none { it.sortOrder == logged.sortOrder } }
            .sortedBy { it.sortOrder }
            .map { it.toDraft() }
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
        actualDurationSeconds = actualDurationSeconds,
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
        actualDurationSeconds = actualDurationSeconds,
    )

    private fun com.coachfoska.app.domain.model.Exercise.toSessionDraft(): ExerciseDraft {
        val setCount = if (logType == ExerciseLogType.TIME) 1 else 3
        val repsGoal = if (logType == ExerciseLogType.TIME) null else 10
        return ExerciseDraft(
            exerciseName = name,
            imageUrl = imageUrl,
            imageUrl2 = imageUrl2,
            animationUrl = animationUrl,
            lottieAnimations = lottieAnimations,
            videoUrl = videoUrl,
            muscleGroup = muscles.firstOrNull() ?: category?.name,
            exerciseId = id,
            logType = logType,
            initialSetsGoal = setCount,
            initialRepsGoal = repsGoal?.toString() ?: "time",
            sets = (1..setCount).map { order ->
                SetDraft(
                    sortOrder = order,
                    targetReps = repsGoal,
                    actualReps = repsGoal,
                    targetWeightKg = null,
                    actualWeightKg = null,
                    rpe = null,
                    targetRestSeconds = null,
                    actualRestSeconds = null,
                    setType = SetType.NORMAL,
                    actualDurationSeconds = null,
                )
            },
        )
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}

/**
 * Resolves the current (exerciseIndex, setIndex) of a set from its stable identity so that
 * asynchronous save handlers stay correct even if the athlete reordered exercises meanwhile.
 * Exercise name is the identity key used throughout this feature (previous data, media enrichment,
 * resume matching); sortOrder is stable per set across reorders and edits.
 */
private fun SessionDraft.locateSet(exerciseName: String, sortOrder: Int): Pair<Int, Int>? {
    val exerciseIndex = exercises.indexOfFirst { it.exerciseName == exerciseName }
    if (exerciseIndex < 0) return null
    val setIndex = exercises[exerciseIndex].sets.indexOfFirst { it.sortOrder == sortOrder }
    if (setIndex < 0) return null
    return exerciseIndex to setIndex
}

private fun SetDraft.hasSamePersistedValuesAs(other: SetDraft): Boolean =
    sortOrder == other.sortOrder &&
        targetReps == other.targetReps &&
        actualReps == other.actualReps &&
        targetWeightKg == other.targetWeightKg &&
        actualWeightKg == other.actualWeightKg &&
        rpe == other.rpe &&
        targetRestSeconds == other.targetRestSeconds &&
        actualRestSeconds == other.actualRestSeconds &&
        completed == other.completed &&
        actualDurationSeconds == other.actualDurationSeconds
