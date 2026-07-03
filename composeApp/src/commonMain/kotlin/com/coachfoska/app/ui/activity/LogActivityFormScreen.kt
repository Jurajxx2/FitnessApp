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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.activity_distance_label
import coachfoska.composeapp.generated.resources.activity_duration_label
import coachfoska.composeapp.generated.resources.activity_easy
import coachfoska.composeapp.generated.resources.activity_effort_section
import coachfoska.composeapp.generated.resources.activity_hard
import coachfoska.composeapp.generated.resources.activity_notes_label
import coachfoska.composeapp.generated.resources.activity_rpe_format
import coachfoska.composeapp.generated.resources.activity_save
import coachfoska.composeapp.generated.resources.activity_when_section
import coachfoska.composeapp.generated.resources.common_cancel
import coachfoska.composeapp.generated.resources.common_ok
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.presentation.activity.ActivityLogIntent
import com.coachfoska.app.presentation.activity.ActivityLogState
import com.coachfoska.app.presentation.activity.ActivityLogViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar
import androidx.compose.ui.tooling.preview.Preview
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import org.jetbrains.compose.resources.stringResource
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
                label = stringResource(Res.string.activity_duration_label),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )

            if (showDistance) {
                Spacer(Modifier.height(12.dp))
                CoachTextField(
                    value = state.distanceKmText,
                    onValueChange = { onIntent(ActivityLogIntent.UpdateDistance(it)) },
                    label = stringResource(Res.string.activity_distance_label),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.height(16.dp))
            CoachSectionHeader(stringResource(Res.string.activity_effort_section))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(Res.string.activity_easy), style = MaterialTheme.typography.labelSmall)
                Slider(
                    value = (state.rpe ?: 5).toFloat(),
                    onValueChange = { onIntent(ActivityLogIntent.UpdateRpe(it.toInt())) },
                    valueRange = 1f..10f,
                    steps = 8,
                    modifier = Modifier.weight(1f),
                )
                Text(stringResource(Res.string.activity_hard), style = MaterialTheme.typography.labelSmall)
            }
            Text(
                text = stringResource(Res.string.activity_rpe_format, state.rpe?.toString() ?: "-"),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(start = 8.dp),
            )

            Spacer(Modifier.height(16.dp))
            CoachSectionHeader(stringResource(Res.string.activity_when_section))
            LoggedAtPicker(
                loggedAt = state.loggedAt,
                onChange = { onIntent(ActivityLogIntent.UpdateLoggedAt(it)) },
            )

            Spacer(Modifier.height(16.dp))
            CoachTextField(
                value = state.notes,
                onValueChange = { onIntent(ActivityLogIntent.UpdateNotes(it)) },
                label = stringResource(Res.string.activity_notes_label),
                singleLine = false,
                modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp),
            )

            if (state.error != null) {
                Spacer(Modifier.height(12.dp))
                Text(state.error, color = MaterialTheme.colorScheme.error)
            }
        }

        CoachButton(
            text = stringResource(Res.string.activity_save),
            onClick = { onIntent(ActivityLogIntent.Submit) },
            isLoading = state.isLogging,
            enabled = state.canSubmit,
            modifier = Modifier.fillMaxWidth().padding(16.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LoggedAtPicker(
    loggedAt: kotlinx.datetime.Instant?,
    onChange: (kotlinx.datetime.Instant) -> Unit,
) {
    val zone = remember { TimeZone.currentSystemDefault() }
    val effective = loggedAt ?: currentInstant()
    val localDateTime = remember(effective) { effective.toLocalDateTime(zone) }

    var showDatePicker by remember { mutableStateOf(false) }
    var pendingDate by remember { mutableStateOf<LocalDate?>(null) }

    OutlinedButton(
        onClick = { showDatePicker = true },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(if (loggedAt == null) "Now (${effective.toDisplayDateTime()})" else effective.toDisplayDateTime())
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = effective.toEpochMilliseconds(),
        )
        AlertDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val millis = datePickerState.selectedDateMillis
                    if (millis != null) {
                        pendingDate = kotlinx.datetime.Instant.fromEpochMilliseconds(millis)
                            .toLocalDateTime(TimeZone.UTC).date
                    }
                    showDatePicker = false
                }) { Text(stringResource(Res.string.common_ok)) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text(stringResource(Res.string.common_cancel)) }
            },
            text = { DatePicker(state = datePickerState) },
        )
    }

    val date = pendingDate
    if (date != null) {
        val timePickerState = rememberTimePickerState(
            initialHour = localDateTime.hour,
            initialMinute = localDateTime.minute,
            is24Hour = true,
        )
        AlertDialog(
            onDismissRequest = { pendingDate = null },
            confirmButton = {
                TextButton(onClick = {
                    val combined = LocalDateTime(
                        year = date.year,
                        monthNumber = date.monthNumber,
                        dayOfMonth = date.dayOfMonth,
                        hour = timePickerState.hour,
                        minute = timePickerState.minute,
                        second = 0,
                        nanosecond = 0,
                    )
                    onChange(combined.toInstant(zone))
                    pendingDate = null
                }) { Text(stringResource(Res.string.common_ok)) }
            },
            dismissButton = {
                TextButton(onClick = { pendingDate = null }) { Text(stringResource(Res.string.common_cancel)) }
            },
            text = { TimePicker(state = timePickerState) },
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
