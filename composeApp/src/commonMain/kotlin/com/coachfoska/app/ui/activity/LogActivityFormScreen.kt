package com.coachfoska.app.ui.activity

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.presentation.activity.ActivityLogIntent
import com.coachfoska.app.presentation.activity.ActivityLogState
import com.coachfoska.app.presentation.activity.ActivityLogViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar
import androidx.compose.ui.tooling.preview.Preview
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun LogActivityFormRoute(
    userId: String,
    type: ActivityType,
    onBackClick: () -> Unit,
    onSaved: () -> Unit,
    viewModel: ActivityLogViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(type) { viewModel.onIntent(ActivityLogIntent.UpdateType(type)) }
    LaunchedEffect(state.success) {
        if (state.success) {
            viewModel.onIntent(ActivityLogIntent.ResetSuccess)
            onSaved()
        }
    }
    LogActivityFormScreen(state = state, onIntent = viewModel::onIntent, onBackClick = onBackClick)
}

@Composable
fun LogActivityFormScreen(
    state: ActivityLogState,
    onIntent: (ActivityLogIntent) -> Unit,
    onBackClick: () -> Unit,
) {
    val showDistance = state.selectedType in listOf(
        ActivityType.WALKING,
        ActivityType.RUNNING,
        ActivityType.CYCLING,
        ActivityType.SWIMMING,
    )

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(
            title = "LOG ${state.selectedType.displayName.uppercase()}",
            onBackClick = onBackClick,
        )

        Column(
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
                .weight(1f),
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = state.selectedType.displayName,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(12.dp),
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
            Spacer(Modifier.height(16.dp))

            CoachTextField(
                value = state.durationMinutesText,
                onValueChange = { onIntent(ActivityLogIntent.UpdateDuration(it)) },
                label = "Duration (minutes)",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )

            if (showDistance) {
                Spacer(Modifier.height(12.dp))
                CoachTextField(
                    value = state.distanceKmText,
                    onValueChange = { onIntent(ActivityLogIntent.UpdateDistance(it)) },
                    label = "Distance (km)",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.height(16.dp))
            CoachSectionHeader("EFFORT (1-10)")
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Easy", style = MaterialTheme.typography.labelSmall)
                Slider(
                    value = (state.rpe ?: 5).toFloat(),
                    onValueChange = { onIntent(ActivityLogIntent.UpdateRpe(it.toInt())) },
                    valueRange = 1f..10f,
                    steps = 8,
                    modifier = Modifier.weight(1f),
                )
                Text("Hard", style = MaterialTheme.typography.labelSmall)
            }
            Text(
                text = "RPE ${state.rpe ?: "-"}",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(start = 8.dp),
            )

            Spacer(Modifier.height(16.dp))
            CoachTextField(
                value = state.notes,
                onValueChange = { onIntent(ActivityLogIntent.UpdateNotes(it)) },
                label = "Notes",
                singleLine = false,
                modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp),
            )

            if (state.error != null) {
                Spacer(Modifier.height(12.dp))
                Text(state.error, color = MaterialTheme.colorScheme.error)
            }
        }

        CoachButton(
            text = "SAVE ACTIVITY",
            onClick = { onIntent(ActivityLogIntent.Submit) },
            isLoading = state.isLogging,
            enabled = state.canSubmit,
            modifier = Modifier.fillMaxWidth().padding(16.dp),
        )
    }
}

@Preview
@Composable
private fun LogActivityFormScreenPreviewRunningEmpty() {
    LogActivityFormScreen(
        state = ActivityLogState(selectedType = ActivityType.RUNNING),
        onIntent = {},
        onBackClick = {},
    )
}

@Preview
@Composable
private fun LogActivityFormScreenPreviewYogaEmpty() {
    LogActivityFormScreen(
        state = ActivityLogState(selectedType = ActivityType.YOGA),
        onIntent = {},
        onBackClick = {},
    )
}

@Preview
@Composable
private fun LogActivityFormScreenPreviewFilled() {
    LogActivityFormScreen(
        state = ActivityLogState(
            selectedType = ActivityType.CYCLING,
            durationMinutesText = "60",
            distanceKmText = "20.5",
            rpe = 7,
            notes = "Mostly flat route.",
            canSubmit = true,
        ),
        onIntent = {},
        onBackClick = {},
    )
}
