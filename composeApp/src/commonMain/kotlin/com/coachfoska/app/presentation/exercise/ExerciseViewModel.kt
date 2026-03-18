package com.coachfoska.app.presentation.exercise

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.exercise.GetExerciseByIdUseCase
import com.coachfoska.app.domain.usecase.exercise.SearchExercisesUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ExerciseViewModel"

class ExerciseViewModel(
    private val searchExercisesUseCase: SearchExercisesUseCase,
    private val getExerciseByIdUseCase: GetExerciseByIdUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(ExerciseState())
    val state: StateFlow<ExerciseState> = _state.asStateFlow()

    fun onIntent(intent: ExerciseIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            is ExerciseIntent.SearchQueryChanged -> _state.update { it.copy(searchQuery = intent.query) }
            ExerciseIntent.Search -> search()
            is ExerciseIntent.SelectExercise -> loadExerciseDetail(intent.exerciseId)
            ExerciseIntent.ClearSelection -> _state.update { it.copy(selectedExercise = null) }
            ExerciseIntent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun search() {
        viewModelScope.launch {
            _state.update { it.copy(isSearching = true, error = null) }
            searchExercisesUseCase(_state.value.searchQuery)
                .onSuccess { results -> _state.update { it.copy(isSearching = false, searchResults = results) } }
                .onFailure { e ->
                    Napier.e("search failed", e, tag = TAG)
                    _state.update { it.copy(isSearching = false, error = e.message) }
                }
        }
    }

    private fun loadExerciseDetail(id: Int) {
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
}
