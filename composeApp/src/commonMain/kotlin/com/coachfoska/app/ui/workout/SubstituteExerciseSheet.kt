package com.coachfoska.app.ui.workout

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.substitute_suggested
import coachfoska.composeapp.generated.resources.substitute_title
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.ui.workout.components.ExerciseSearchList
import com.coachfoska.app.ui.workout.components.ExerciseSearchRow
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.koinInject

/**
 * Bottom sheet for selecting a replacement exercise.
 *
 * - Shows a "Same muscle group" suggestions section when [currentExerciseId] is non-null and
 *   its category can be resolved; skips suggestions otherwise.
 * - Shows a search field powered by [ExerciseRepository.searchExercises].
 * - Calls [onExerciseSelected] and [onDismiss] when an exercise is tapped.
 *
 * Session-scope vs. plan-forward behaviour is decided entirely by the caller; this sheet is
 * agnostic about scope.
 */
@OptIn(ExperimentalMaterial3Api::class, FlowPreview::class)
@Composable
fun SubstituteExerciseSheet(
    currentExerciseId: String?,
    sheetState: SheetState,
    onExerciseSelected: (Exercise) -> Unit,
    onDismiss: () -> Unit,
    exerciseRepository: ExerciseRepository = koinInject(),
) {
    val scope = rememberCoroutineScope()

    var suggestions by remember { mutableStateOf<List<Exercise>>(emptyList()) }
    var searchQuery by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }
    var searchResults by remember { mutableStateOf<List<Exercise>>(emptyList()) }

    // Load category suggestions when we have an exerciseId
    LaunchedEffect(currentExerciseId) {
        if (currentExerciseId == null) return@LaunchedEffect
        exerciseRepository.getExerciseById(currentExerciseId).onSuccess { exercise ->
            val categoryId = exercise.category?.id ?: return@onSuccess
            exerciseRepository.getExercisesByCategory(categoryId).onSuccess { list ->
                // Exclude the current exercise itself from suggestions
                suggestions = list.filter { it.id != currentExerciseId }.take(6)
            }
        }
    }

    // Debounced search
    val queryFlow = remember { MutableStateFlow("") }
    LaunchedEffect(Unit) {
        queryFlow
            .debounce(300L)
            .distinctUntilChanged()
            .collect { q ->
                if (q.isBlank()) {
                    isSearching = false
                    searchResults = emptyList()
                } else {
                    isSearching = true
                    exerciseRepository.searchExercises(q).onSuccess { results ->
                        searchResults = results
                    }.onFailure {
                        searchResults = emptyList()
                    }
                    isSearching = false
                }
            }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = DsTheme.spacing.xl)
        ) {
            Text(
                text = stringResource(Res.string.substitute_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = DsTheme.spacing.md)
            )

            // Suggestions section — only if we resolved suggestions
            if (suggestions.isNotEmpty()) {
                Text(
                    text = stringResource(Res.string.substitute_suggested),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(bottom = DsTheme.spacing.sm)
                )
                suggestions.forEach { exercise ->
                    ExerciseSearchRow(
                        exercise = exercise,
                        onClick = {
                            onExerciseSelected(exercise)
                            onDismiss()
                        }
                    )
                }
                HorizontalDivider(
                    modifier = Modifier.padding(vertical = DsTheme.spacing.md),
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f)
                )
            }

            // Search section
            ExerciseSearchList(
                query = searchQuery,
                onQueryChange = { q ->
                    searchQuery = q
                    scope.launch { queryFlow.emit(q) }
                },
                isSearching = isSearching,
                searchResults = searchResults,
                onExerciseClick = { exercise ->
                    onExerciseSelected(exercise)
                    onDismiss()
                },
            )

            Spacer(modifier = Modifier.height(DsTheme.spacing.xxl))
        }
    }
}
