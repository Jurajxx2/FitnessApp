package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.editor_picker_done
import coachfoska.composeapp.generated.resources.editor_picker_title
import coachfoska.composeapp.generated.resources.editor_search_exercises
import com.coachfoska.app.presentation.workout.WorkoutEditorIntent
import com.coachfoska.app.presentation.workout.WorkoutEditorState
import com.coachfoska.app.theme.Spacing
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.app.ui.workout.components.ExerciseSearchList
import org.jetbrains.compose.resources.stringResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExercisePickerSheet(
    state: WorkoutEditorState,
    sheetState: SheetState,
    onIntent: (WorkoutEditorIntent) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.xl)
        ) {
            Text(
                text = stringResource(Res.string.editor_picker_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = Spacing.md)
            )

            ExerciseSearchList(
                query = state.searchQuery,
                onQueryChange = { onIntent(WorkoutEditorIntent.SearchExercises(it)) },
                isSearching = state.isSearching,
                searchResults = state.searchResults,
                onExerciseClick = { onIntent(WorkoutEditorIntent.AddExercise(it)) },
                placeholderText = stringResource(Res.string.editor_search_exercises),
            )

            Spacer(modifier = Modifier.height(Spacing.md))

            DsButton(
                text = stringResource(Res.string.editor_picker_done),
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(Spacing.xl))
        }
    }
}
