package com.coachfoska.app.presentation.exercise

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.exercise.GetExerciseByIdUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExerciseCategoriesUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExercisesUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExercisesUseCase.Companion.PAGE_SIZE
import com.coachfoska.app.domain.usecase.exercise.GetFavoriteExerciseIdsUseCase
import com.coachfoska.app.domain.usecase.exercise.ToggleFavoriteExerciseUseCase
import com.coachfoska.app.core.logging.AppLogger as Napier
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ExerciseViewModel"

class ExerciseViewModel(
    private val getExercisesUseCase: GetExercisesUseCase,
    private val getExerciseByIdUseCase: GetExerciseByIdUseCase,
    private val getExerciseCategoriesUseCase: GetExerciseCategoriesUseCase,
    private val getFavoriteExerciseIdsUseCase: GetFavoriteExerciseIdsUseCase,
    private val toggleFavoriteExerciseUseCase: ToggleFavoriteExerciseUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(ExerciseState())
    val state: StateFlow<ExerciseState> = _state.asStateFlow()

    private var loadJob: Job? = null

    init {
        loadCategories()
        loadFavorites()
        loadExercises(reset = true)
    }

    fun onIntent(intent: ExerciseIntent) {
        Napier.d("Intent received: ${intent::class.simpleName}", tag = TAG)
        when (intent) {
            is ExerciseIntent.SearchQueryChanged -> {
                _state.update { it.copy(searchQuery = intent.query) }
                loadExercises(reset = true)
            }
            ExerciseIntent.LoadMoreExercises -> loadExercises(reset = false)
            is ExerciseIntent.SelectCategoryFilter -> {
                val newId = if (_state.value.selectedCategoryId == intent.categoryId) null else intent.categoryId
                _state.update { it.copy(selectedCategoryId = newId) }
                loadExercises(reset = true)
            }
            is ExerciseIntent.SelectDifficultyFilter -> {
                val newDiff = if (_state.value.selectedDifficulty == intent.difficulty) null else intent.difficulty
                _state.update { it.copy(selectedDifficulty = newDiff) }
                loadExercises(reset = true)
            }
            is ExerciseIntent.SelectSortOrder -> {
                _state.update { it.copy(sortOrder = intent.order) }
                loadExercises(reset = true)
            }
            is ExerciseIntent.SelectExercise -> loadExerciseDetail(intent.exerciseId)
            is ExerciseIntent.SelectExerciseByName -> loadExerciseDetailByName(intent.exerciseName)
            ExerciseIntent.ClearSelection -> _state.update { it.copy(selectedExercise = null) }
            ExerciseIntent.DismissError -> _state.update { it.copy(error = null) }
            is ExerciseIntent.ToggleFavorite -> toggleFavorite(intent.exerciseId)
            ExerciseIntent.ToggleFavoritesFilter -> {
                _state.update { it.copy(showOnlyFavorites = !it.showOnlyFavorites) }
                loadExercises(reset = true)
            }
        }
    }

    private fun loadExercises(reset: Boolean) {
        if (!reset) {
            val s = _state.value
            if (!s.hasMore || s.isLoadingMore || s.isLoadingExercises) return
        }
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            val s = _state.value
            val offset = if (reset) 0 else s.exercises.size

            // When favorites filter is active but list is empty, skip network call
            if (s.showOnlyFavorites && s.favoriteIds.isEmpty()) {
                _state.update { it.copy(exercises = emptyList(), hasMore = false, isLoadingExercises = false, isLoadingMore = false) }
                return@launch
            }

            if (reset) {
                _state.update { it.copy(isLoadingExercises = true, error = null) }
            } else {
                _state.update { it.copy(isLoadingMore = true, error = null) }
            }

            val idsFilter = if (s.showOnlyFavorites) s.favoriteIds.toList() else null

            getExercisesUseCase(
                offset = offset,
                categoryId = s.selectedCategoryId,
                query = s.searchQuery.takeIf { it.isNotBlank() },
                difficulty = s.selectedDifficulty,
                sortDescending = s.sortOrder == ExerciseSortOrder.NAME_DESC,
                ids = idsFilter
            ).onSuccess { results ->
                _state.update { cur ->
                    cur.copy(
                        isLoadingExercises = false,
                        isLoadingMore = false,
                        exercises = if (reset) results else cur.exercises + results,
                        hasMore = results.size == PAGE_SIZE
                    )
                }
            }.onFailure { e ->
                if (e is CancellationException) throw e
                Napier.e("loadExercises failed", e, tag = TAG)
                _state.update { it.copy(isLoadingExercises = false, isLoadingMore = false, error = e.message) }
            }
        }
    }

    private fun loadCategories() {
        viewModelScope.launch {
            _state.update { it.copy(isCategoriesLoading = true) }
            getExerciseCategoriesUseCase()
                .onSuccess { cats -> _state.update { it.copy(isCategoriesLoading = false, categories = cats) } }
                .onFailure { e ->
                    Napier.e("loadCategories failed", e, tag = TAG)
                    _state.update { it.copy(isCategoriesLoading = false) }
                }
        }
    }

    private fun loadExerciseDetail(id: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoadingDetail = true) }
            getExerciseByIdUseCase(id)
                .onSuccess { exercise -> _state.update { it.copy(isLoadingDetail = false, selectedExercise = exercise) } }
                .onFailure { e ->
                    Napier.e("loadExerciseDetail($id) failed", e, tag = TAG)
                    _state.update { it.copy(isLoadingDetail = false, error = e.message) }
                }
        }
    }

    private fun loadExerciseDetailByName(name: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoadingDetail = true, error = null) }
            getExercisesUseCase(offset = 0, limit = 5, query = name)
                .onSuccess { results ->
                    val exercise = results.firstOrNull { it.name.equals(name, ignoreCase = true) }
                        ?: results.firstOrNull()
                    _state.update {
                        it.copy(
                            isLoadingDetail = false,
                            selectedExercise = exercise,
                            error = if (exercise == null) "Exercise not found." else null,
                        )
                    }
                }
                .onFailure { e ->
                    Napier.e("loadExerciseDetailByName failed", e, tag = TAG)
                    _state.update { it.copy(isLoadingDetail = false, error = e.message) }
                }
        }
    }

    private fun loadFavorites() {
        viewModelScope.launch {
            _state.update { it.copy(isFavoritesLoading = true) }
            getFavoriteExerciseIdsUseCase(userId)
                .onSuccess { ids -> _state.update { it.copy(isFavoritesLoading = false, favoriteIds = ids) } }
                .onFailure { e ->
                    Napier.e("loadFavorites failed", e, tag = TAG)
                    _state.update { it.copy(isFavoritesLoading = false) }
                }
        }
    }

    private fun toggleFavorite(exerciseId: String) {
        val current = _state.value.favoriteIds
        val nowFavorite = exerciseId !in current
        // Optimistic update
        _state.update {
            it.copy(favoriteIds = if (nowFavorite) current + exerciseId else current - exerciseId)
        }
        viewModelScope.launch {
            toggleFavoriteExerciseUseCase(userId, exerciseId, nowFavorite)
                .onFailure { e ->
                    Napier.e("toggleFavorite($exerciseId) failed", e, tag = TAG)
                    // Revert on failure
                    _state.update {
                        it.copy(favoriteIds = if (nowFavorite) it.favoriteIds - exerciseId else it.favoriteIds + exerciseId)
                    }
                }
        }
    }
}
