package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.domain.model.WorkoutDraft
import com.coachfoska.app.domain.model.WorkoutExerciseDraft
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WorkoutSource
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.DeleteUserWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.ExerciseSwap
import com.coachfoska.app.domain.usecase.workout.ForkWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.GetAllWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.SaveUserWorkoutUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "WorkoutViewModel"

class WorkoutViewModel(
    private val getAssignedWorkoutsUseCase: GetAssignedWorkoutsUseCase,
    private val getAllWorkoutsUseCase: GetAllWorkoutsUseCase,
    private val getWorkoutByIdUseCase: GetWorkoutByIdUseCase,
    private val logWorkoutUseCase: LogWorkoutUseCase,
    private val getWorkoutHistoryUseCase: GetWorkoutHistoryUseCase,
    private val deleteUserWorkoutUseCase: DeleteUserWorkoutUseCase,
    private val saveUserWorkoutUseCase: SaveUserWorkoutUseCase,
    private val forkWorkoutUseCase: ForkWorkoutUseCase,
    private val workoutRepository: WorkoutRepository,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(WorkoutState())
    val state: StateFlow<WorkoutState> = _state.asStateFlow()

    init {
        onIntent(WorkoutIntent.LoadWorkouts)
        onIntent(WorkoutIntent.LoadAllWorkouts)
        onIntent(WorkoutIntent.LoadHistory)
        onIntent(WorkoutIntent.LoadInProgressSession)
    }

    fun onIntent(intent: WorkoutIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            WorkoutIntent.LoadWorkouts -> loadWorkouts()
            WorkoutIntent.LoadAllWorkouts -> loadAllWorkouts()
            WorkoutIntent.LoadInProgressSession -> loadInProgressSession()
            is WorkoutIntent.SelectWorkout -> selectWorkout(intent.workoutId)
            WorkoutIntent.LoadHistory -> loadHistory()
            is WorkoutIntent.LogWorkout -> logWorkout(intent)
            is WorkoutIntent.DeleteWorkout -> deleteWorkout(intent.workoutId)
            is WorkoutIntent.SubstitutePlanExercise -> substitutePlanExercise(intent)
            WorkoutIntent.DismissError -> _state.update { it.copy(error = null) }
            WorkoutIntent.DismissPlanSubstitution -> _state.update { it.copy(lastPlanSubstitution = null) }
            WorkoutIntent.WorkoutLogged -> _state.update { it.copy(workoutLoggedSuccess = false) }
            is WorkoutIntent.SelectWorkoutLog -> selectWorkoutLog(intent.logId)
            is WorkoutIntent.AttachVideoToLog -> { /* TODO */ }
            
            is WorkoutIntent.InitDraftFromWorkout -> initDraft(intent.workoutId)
            is WorkoutIntent.UpdateSetActual -> updateSetActual(intent)
            is WorkoutIntent.MarkSetComplete -> markSetComplete(intent)
            is WorkoutIntent.AddExtraSet -> addExtraSet(intent.exerciseIndex)
            is WorkoutIntent.RemoveSet -> removeSet(intent.exerciseIndex, intent.setIndex)
            is WorkoutIntent.SubmitActiveSession -> submitDraft(intent.durationMinutes, intent.notes)
        }
    }

    private fun loadWorkouts() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getAssignedWorkoutsUseCase(userId)
                .onSuccess { workouts -> _state.update { it.copy(workouts = workouts, isLoading = false) } }
                .onFailure { e -> _state.update { it.copy(error = e.message, isLoading = false) } }
        }
    }

    private fun loadAllWorkouts() {
        viewModelScope.launch {
            getAllWorkoutsUseCase()
                .onSuccess { workouts -> _state.update { it.copy(allWorkouts = workouts) } }
                .onFailure { e -> _state.update { it.copy(error = e.message) } }
        }
    }

    private fun selectWorkout(workoutId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getWorkoutByIdUseCase(workoutId)
                .onSuccess { workout -> _state.update { it.copy(selectedWorkout = workout, isLoading = false) } }
                .onFailure { e -> _state.update { it.copy(error = e.message, isLoading = false) } }
        }
    }

    private fun logWorkout(intent: WorkoutIntent.LogWorkout) {
        viewModelScope.launch {
            _state.update { it.copy(isLogging = true) }
            logWorkoutUseCase(
                userId, intent.workoutId, intent.workoutName,
                intent.durationMinutes, intent.notes, intent.exerciseLogs
            ).onSuccess {
                _state.update { it.copy(isLogging = false, workoutLoggedSuccess = true) }
                loadHistory()
            }.onFailure { e ->
                _state.update { it.copy(isLogging = false, error = e.message) }
            }
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isHistoryLoading = true) }
            getWorkoutHistoryUseCase(userId)
                .onSuccess { history ->
                    val lastPerformed = history
                        .filter { it.workoutId != null }
                        .groupBy { it.workoutId!! }
                        .mapValues { (_, logs) -> logs.maxBy { it.loggedAt }.loggedAt }
                    _state.update {
                        it.copy(
                            workoutHistory = history,
                            lastPerformedByWorkoutId = lastPerformed,
                            isHistoryLoading = false,
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(error = e.message, isHistoryLoading = false) } }
        }
    }

    private fun loadInProgressSession() {
        viewModelScope.launch {
            workoutRepository.getInProgressSession(userId)
                .onSuccess { log -> _state.update { it.copy(inProgressSession = log) } }
                .onFailure { e -> Napier.e("Failed to load in-progress session", e, tag = TAG) }
        }
    }

    private fun deleteWorkout(workoutId: String) {
        viewModelScope.launch {
            deleteUserWorkoutUseCase(workoutId)
                .onSuccess {
                    // Reload assigned workouts so the deleted plan disappears from the list
                    loadWorkouts()
                }
                .onFailure { e -> _state.update { it.copy(error = e.message) } }
        }
    }

    private fun substitutePlanExercise(intent: WorkoutIntent.SubstitutePlanExercise) {
        val workout = _state.value.selectedWorkout ?: return
        val ordered = workout.exercises.sortedBy { it.sortOrder }
        if (intent.exerciseIndex !in ordered.indices) return

        val old = ordered[intent.exerciseIndex]
        val replacement = intent.replacement
        val swap = ExerciseSwap(
            exerciseIndex = intent.exerciseIndex,
            newExerciseId = replacement.id,
            newName = replacement.name,
            newMuscleGroup = replacement.muscles.firstOrNull() ?: replacement.category?.name,
        )

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            val result = if (workout.source == WorkoutSource.COACH) {
                forkWorkoutUseCase(userId, workout, swap)
            } else {
                val draft = WorkoutDraft(
                    name = workout.name,
                    dayOfWeek = workout.dayOfWeek,
                    notes = workout.notes,
                    exercises = ordered.mapIndexed { index, ex ->
                        if (index == intent.exerciseIndex) {
                            WorkoutExerciseDraft(
                                exerciseId = replacement.id,
                                name = replacement.name,
                                muscleGroup = swap.newMuscleGroup,
                                sets = ex.sets,
                                reps = ex.reps,
                                restSeconds = ex.restSeconds,
                                tips = ex.tips,
                                substitutedFromExerciseId = ex.substitutedFromExerciseId ?: ex.exerciseId,
                                substitutedFromName = ex.substitutedFromName ?: ex.name,
                            )
                        } else {
                            WorkoutExerciseDraft(
                                exerciseId = ex.exerciseId,
                                name = ex.name,
                                muscleGroup = ex.muscleGroup,
                                sets = ex.sets,
                                reps = ex.reps,
                                restSeconds = ex.restSeconds,
                                tips = ex.tips,
                                substitutedFromExerciseId = ex.substitutedFromExerciseId,
                                substitutedFromName = ex.substitutedFromName,
                            )
                        }
                    },
                )
                saveUserWorkoutUseCase(userId, draft, workout.id)
            }

            result
                .onSuccess { updated ->
                    _state.update {
                        it.copy(
                            selectedWorkout = updated,
                            lastPlanSubstitution = Pair(old.name, replacement.name),
                            isLoading = false,
                        )
                    }
                    loadWorkouts()
                }
                .onFailure { e ->
                    _state.update { it.copy(error = e.message, isLoading = false) }
                }
        }
    }

    private fun selectWorkoutLog(logId: String) {
        viewModelScope.launch {
            if (_state.value.workoutHistory.isEmpty()) {
                _state.update { it.copy(isHistoryLoading = true) }
                getWorkoutHistoryUseCase(userId)
                    .onSuccess { history -> 
                        val log = history.find { it.id == logId }
                        _state.update { it.copy(workoutHistory = history, selectedWorkoutLog = log, isHistoryLoading = false) }
                    }
                    .onFailure { e -> 
                        _state.update { it.copy(error = e.message, isHistoryLoading = false) }
                    }
            } else {
                val log = _state.value.workoutHistory.find { it.id == logId }
                _state.update { it.copy(selectedWorkoutLog = log) }
            }
        }
    }

    private fun initDraft(workoutId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getWorkoutByIdUseCase(workoutId).onSuccess { workout ->
                _state.update { it.copy(
                    sessionDraft = workout.toDraft(currentInstant().toEpochMilliseconds()),
                    isLoading = false
                ) }
            }.onFailure { e ->
                _state.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    private fun updateSetActual(intent: WorkoutIntent.UpdateSetActual) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[intent.exerciseIndex]
            val updatedSets = ex.sets.toMutableList()
            updatedSets[intent.setIndex] = updatedSets[intent.setIndex].copy(
                actualReps = intent.reps,
                actualWeightKg = intent.weight,
                rpe = intent.rpe
            )
            updatedEx[intent.exerciseIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun markSetComplete(intent: WorkoutIntent.MarkSetComplete) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[intent.exerciseIndex]
            val updatedSets = ex.sets.toMutableList()
            updatedSets[intent.setIndex] = updatedSets[intent.setIndex].copy(completed = intent.completed)
            updatedEx[intent.exerciseIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
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
                actualReps = lastSet?.actualReps, // Fix: inherited from previous set per plan
                targetWeightKg = lastSet?.targetWeightKg,
                actualWeightKg = lastSet?.actualWeightKg, // Fix: inherited from previous set per plan
                rpe = null, // Reset for new set
                targetRestSeconds = lastSet?.targetRestSeconds,
                actualRestSeconds = null
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

    private fun submitDraft(durationMinutes: Int, notes: String?) {
        val draft = _state.value.sessionDraft ?: return
        
        val exerciseLogs = draft.exercises.filter { ex -> ex.sets.any { it.completed } }.map { ex ->
            ExerciseLog(
                id = "", workoutLogId = "",
                exerciseName = ex.exerciseName, notes = null,
                videoUrl = ex.videoUrl,
                sets = ex.sets.filter { it.completed }.map { s ->
                    SetLog(
                        id = "", exerciseLogId = "", sortOrder = s.sortOrder,
                        targetReps = s.targetReps, actualReps = s.actualReps,
                        targetWeightKg = s.targetWeightKg, actualWeightKg = s.actualWeightKg,
                        rpe = s.rpe, targetRestSeconds = s.targetRestSeconds, actualRestSeconds = s.actualRestSeconds,
                        completed = true
                    )
                }
            )
        }

        if (exerciseLogs.isEmpty()) {
            _state.update { it.copy(error = "No completed sets to save.") }
            return
        }

        onIntent(WorkoutIntent.LogWorkout(
            workoutId = draft.workoutId,
            workoutName = draft.workoutName,
            durationMinutes = durationMinutes,
            notes = notes,
            exerciseLogs = exerciseLogs
        ))
    }
}
