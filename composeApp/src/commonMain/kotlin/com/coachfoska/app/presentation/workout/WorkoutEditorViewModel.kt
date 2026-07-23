package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.WorkoutDraft
import com.coachfoska.app.domain.model.WorkoutExerciseDraft
import com.coachfoska.app.domain.model.resolvedLogType
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// ── State ─────────────────────────────────────────────────────────────────────

data class EditorExercise(
    val exerciseId: String?,
    val name: String,
    val muscleGroup: String?,
    val sets: Int = 3,
    val reps: String = "10",
    val restSeconds: Int = 90,
    val logType: ExerciseLogType = ExerciseLogType.WEIGHT_REPS,
    val targetDurationSeconds: Int? = null,
    val substitutedFromExerciseId: String? = null,
    val substitutedFromName: String? = null,
)

data class WorkoutEditorState(
    val workoutId: String? = null,       // null = create mode
    val name: String = "",
    val dayOfWeek: DayOfWeek? = null,
    val exercises: List<EditorExercise> = emptyList(),
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val savedWorkoutId: String? = null,  // non-null → navigate away
    val nameError: Boolean = false,
    val exercisesError: Boolean = false,
    val error: String? = null,
    // Exercise picker search
    val searchQuery: String = "",
    val searchResults: List<Exercise> = emptyList(),
    val isSearching: Boolean = false,
)

// ── Intents ───────────────────────────────────────────────────────────────────

sealed interface WorkoutEditorIntent {
    data class Load(val workoutId: String?) : WorkoutEditorIntent
    data class UpdateName(val value: String) : WorkoutEditorIntent
    data class UpdateDay(val day: DayOfWeek?) : WorkoutEditorIntent
    data class AddExercise(val exercise: Exercise) : WorkoutEditorIntent
    data class RemoveExercise(val index: Int) : WorkoutEditorIntent
    data class MoveExercise(val index: Int, val delta: Int) : WorkoutEditorIntent
    data class UpdateSets(val index: Int, val sets: Int) : WorkoutEditorIntent
    data class UpdateReps(val index: Int, val reps: String) : WorkoutEditorIntent
    data class UpdateDuration(val index: Int, val seconds: Int) : WorkoutEditorIntent
    data class SetExerciseLogType(val index: Int, val logType: ExerciseLogType) : WorkoutEditorIntent
    data class UpdateRest(val index: Int, val seconds: Int) : WorkoutEditorIntent
    data object Save : WorkoutEditorIntent
    data object DismissError : WorkoutEditorIntent
    data class SearchExercises(val query: String) : WorkoutEditorIntent
}

// ── ViewModel ─────────────────────────────────────────────────────────────────

class WorkoutEditorViewModel(
    private val getWorkoutByIdUseCase: GetWorkoutByIdUseCase,
    private val workoutRepository: WorkoutRepository,
    private val exerciseRepository: ExerciseRepository,
    private val userId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(WorkoutEditorState())
    val state: StateFlow<WorkoutEditorState> = _state.asStateFlow()

    private var searchJob: Job? = null

    fun onIntent(intent: WorkoutEditorIntent) {
        when (intent) {
            is WorkoutEditorIntent.Load -> load(intent.workoutId)
            is WorkoutEditorIntent.UpdateName -> _state.update {
                it.copy(name = intent.value, nameError = false)
            }
            is WorkoutEditorIntent.UpdateDay -> _state.update { it.copy(dayOfWeek = intent.day) }
            is WorkoutEditorIntent.AddExercise -> addExercise(intent.exercise)
            is WorkoutEditorIntent.RemoveExercise -> removeExercise(intent.index)
            is WorkoutEditorIntent.MoveExercise -> moveExercise(intent.index, intent.delta)
            is WorkoutEditorIntent.UpdateSets -> updateSets(intent.index, intent.sets)
            is WorkoutEditorIntent.UpdateReps -> updateReps(intent.index, intent.reps)
            is WorkoutEditorIntent.UpdateDuration -> updateDuration(intent.index, intent.seconds)
            is WorkoutEditorIntent.SetExerciseLogType -> setExerciseLogType(intent.index, intent.logType)
            is WorkoutEditorIntent.UpdateRest -> updateRest(intent.index, intent.seconds)
            is WorkoutEditorIntent.Save -> save()
            is WorkoutEditorIntent.DismissError -> _state.update { it.copy(error = null) }
            is WorkoutEditorIntent.SearchExercises -> searchExercises(intent.query)
        }
    }

    private fun load(workoutId: String?) {
        _state.update { it.copy(workoutId = workoutId) }
        if (workoutId == null) return
        _state.update { it.copy(isLoading = true) }
        viewModelScope.launch {
            getWorkoutByIdUseCase(workoutId).fold(
                onSuccess = { workout ->
                    _state.update { s ->
                        s.copy(
                            isLoading = false,
                            name = workout.name,
                            dayOfWeek = workout.dayOfWeek,
                            exercises = workout.exercises
                                .sortedBy { ex -> ex.sortOrder }
                                .map { ex ->
                                    // Stored log_type is authoritative; inference is fallback-only
                                    // (legacy plans with no stored value). E-7: only legacy TIME
                                    // exercises get an inferred duration — never non-time ones,
                                    // even if their reps text happens to mention "sec"/"min".
                                    val logType = ex.resolvedLogType()
                                    EditorExercise(
                                        exerciseId = ex.exerciseId,
                                        name = ex.name,
                                        muscleGroup = ex.muscleGroup,
                                        sets = ex.sets,
                                        reps = ex.reps,
                                        restSeconds = ex.restSeconds,
                                        logType = logType,
                                        targetDurationSeconds = if (logType == ExerciseLogType.TIME) {
                                            ex.targetDurationSeconds ?: inferLegacyDurationSeconds(ex.reps)
                                        } else {
                                            null
                                        },
                                        substitutedFromExerciseId = ex.substitutedFromExerciseId,
                                        substitutedFromName = ex.substitutedFromName,
                                    )
                                }
                        )
                    }
                },
                onFailure = { e ->
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
            )
        }
    }

    private fun addExercise(exercise: Exercise) {
        val editorExercise = EditorExercise(
            exerciseId = exercise.id,
            name = exercise.name,
            // muscles is List<String>; category.name is fallback
            muscleGroup = exercise.muscles.firstOrNull() ?: exercise.category?.name,
            logType = exercise.logType,
            reps = if (exercise.logType == ExerciseLogType.TIME) "" else "10",
            targetDurationSeconds = if (exercise.logType == ExerciseLogType.TIME) 30 else null,
        )
        _state.update { it.copy(exercises = it.exercises + editorExercise, exercisesError = false) }
    }

    private fun removeExercise(index: Int) {
        _state.update { s ->
            val list = s.exercises.toMutableList()
            if (index < 0 || index >= list.size) return@update s
            list.removeAt(index)
            s.copy(exercises = list)
        }
    }

    private fun moveExercise(index: Int, delta: Int) {
        _state.update { s ->
            val list = s.exercises.toMutableList()
            val target = index + delta
            if (target < 0 || target >= list.size) return@update s
            val item = list.removeAt(index)
            list.add(target, item)
            s.copy(exercises = list)
        }
    }

    private fun updateSets(index: Int, sets: Int) {
        _state.update { s ->
            val list = s.exercises.toMutableList()
            if (index < 0 || index >= list.size) return@update s
            list[index] = list[index].copy(sets = sets)
            s.copy(exercises = list)
        }
    }

    private fun updateReps(index: Int, reps: String) {
        _state.update { s ->
            val list = s.exercises.toMutableList()
            if (index < 0 || index >= list.size) return@update s
            list[index] = list[index].copy(reps = reps)
            s.copy(exercises = list)
        }
    }

    private fun updateDuration(index: Int, seconds: Int) {
        _state.update { s ->
            val list = s.exercises.toMutableList()
            if (index !in list.indices) return@update s
            list[index] = list[index].copy(targetDurationSeconds = seconds.coerceIn(1, 3_600))
            s.copy(exercises = list)
        }
    }

    private fun setExerciseLogType(index: Int, logType: ExerciseLogType) {
        _state.update { s ->
            val list = s.exercises.toMutableList()
            if (index !in list.indices) return@update s
            val current = list[index]
            // Switching to TIME needs a non-null duration goal (default 30s, clamped to the DB
            // CHECK's [1,3600] range); switching away must clear it so the invariant
            // (log_type='time' <=> target_duration_seconds non-null) never breaks in state.
            val newTargetDurationSeconds = if (logType == ExerciseLogType.TIME) {
                (current.targetDurationSeconds ?: 30).coerceIn(1, 3_600)
            } else {
                null
            }
            list[index] = current.copy(logType = logType, targetDurationSeconds = newTargetDurationSeconds)
            s.copy(exercises = list)
        }
    }

    private fun updateRest(index: Int, seconds: Int) {
        _state.update { s ->
            val list = s.exercises.toMutableList()
            if (index < 0 || index >= list.size) return@update s
            list[index] = list[index].copy(restSeconds = seconds)
            s.copy(exercises = list)
        }
    }

    private fun save() {
        val s = _state.value
        val nameError = s.name.isBlank()
        val exercisesError = s.exercises.isEmpty()
        if (nameError || exercisesError) {
            _state.update { it.copy(nameError = nameError, exercisesError = exercisesError) }
            return
        }
        val draft = WorkoutDraft(
            name = s.name.trim(),
            dayOfWeek = s.dayOfWeek,
            notes = null,
            exercises = s.exercises.mapIndexed { idx, ex ->
                WorkoutExerciseDraft(
                    exerciseId = ex.exerciseId,
                    name = ex.name,
                    muscleGroup = ex.muscleGroup,
                    sets = ex.sets,
                    reps = ex.reps,
                    restSeconds = ex.restSeconds,
                    logType = ex.logType,
                    targetDurationSeconds = ex.targetDurationSeconds,
                )
            }
        )
        _state.update { it.copy(isSaving = true) }
        viewModelScope.launch {
            val result = if (s.workoutId == null) {
                workoutRepository.createUserWorkout(userId, draft)
            } else {
                workoutRepository.updateUserWorkout(s.workoutId, draft)
            }
            result.fold(
                onSuccess = { workout ->
                    _state.update { it.copy(isSaving = false, savedWorkoutId = workout.id) }
                },
                onFailure = { e ->
                    _state.update { it.copy(isSaving = false, error = e.message) }
                }
            )
        }
    }

    private fun searchExercises(query: String) {
        _state.update { it.copy(searchQuery = query) }
        searchJob?.cancel()
        if (query.isBlank()) {
            _state.update { it.copy(searchResults = emptyList(), isSearching = false) }
            return
        }
        searchJob = viewModelScope.launch {
            delay(300)
            _state.update { it.copy(isSearching = true) }
            exerciseRepository.searchExercises(query).fold(
                onSuccess = { results ->
                    _state.update { it.copy(searchResults = results, isSearching = false) }
                },
                onFailure = {
                    _state.update { it.copy(isSearching = false) }
                }
            )
        }
    }
}

private fun inferLegacyDurationSeconds(reps: String): Int? {
    val value = reps.trim().lowercase()
    val amount = Regex("\\d+").find(value)?.value?.toIntOrNull() ?: return null
    return when {
        Regex("min|minute|minú").containsMatchIn(value) -> amount * 60
        Regex("sec|second|sek").containsMatchIn(value) -> amount
        else -> null
    }
}
