package com.coachfoska.app.ui.home

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.day_sheet_done
import coachfoska.composeapp.generated.resources.day_sheet_planned
import coachfoska.composeapp.generated.resources.day_sheet_rest_day
import coachfoska.composeapp.generated.resources.day_sheet_workout_completed
import com.coachfoska.app.domain.model.DayActivityStatus
import com.coachfoska.app.domain.model.WeekDayActivity
import com.coachfoska.app.ui.components.localizedName
import org.jetbrains.compose.resources.stringResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DayDetailBottomSheet(
    day: WeekDayActivity,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(bottom = 24.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = day.dayOfWeek.localizedName().uppercase(),
                    style = MaterialTheme.typography.labelLarge,
                    color = DsTheme.colors.textPrimary,
                    letterSpacing = 1.5.sp,
                )
                StatusChip(status = day.status)
            }

            // Planned section
            if (day.plannedWorkout != null) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SheetSectionHeader(stringResource(Res.string.day_sheet_planned))
                    Text(
                        text = day.plannedWorkout.name.uppercase(),
                        style = MaterialTheme.typography.labelLarge,
                        color = DsTheme.colors.textPrimary,
                    )
                    day.plannedWorkout.exercises.forEach { exercise ->
                        SheetExerciseRow(
                            name = exercise.name,
                            detail = "${exercise.sets}×${exercise.reps}",
                        )
                    }
                }
            } else {
                Text(
                    text = stringResource(Res.string.day_sheet_rest_day),
                    style = MaterialTheme.typography.bodyMedium,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
                )
            }

            // Done section
            if (day.completedLog != null) {
                HorizontalDivider(color = DsTheme.colors.textPrimary.copy(alpha = 0.08f))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SheetSectionHeader(stringResource(Res.string.day_sheet_done))
                    Text(
                        text = day.completedLog.workoutName.uppercase(),
                        style = MaterialTheme.typography.labelLarge,
                        color = DsTheme.colors.textPrimary,
                    )
                    day.completedLog.exerciseLogs.forEach { log ->
                        SheetExerciseRow(
                            name = log.exerciseName,
                            detail = log.summaryLine.ifBlank { "Completed" },
                        )
                    }
                }
            } else if (day.status == DayActivityStatus.COMPLETED) {
                HorizontalDivider(color = DsTheme.colors.textPrimary.copy(alpha = 0.08f))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SheetSectionHeader(stringResource(Res.string.day_sheet_done))
                    Text(
                        text = stringResource(Res.string.day_sheet_workout_completed),
                        style = MaterialTheme.typography.bodyMedium,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
                    )
                }
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun SheetSectionHeader(label: String) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = DsTheme.colors.textSecondary,
        letterSpacing = 1.sp,
    )
}

@Composable
private fun SheetExerciseRow(name: String, detail: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = name,
            style = MaterialTheme.typography.bodyMedium,
            color = DsTheme.colors.textPrimary,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = detail,
            style = MaterialTheme.typography.labelMedium,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.6f),
        )
    }
}

@Composable
private fun StatusChip(status: DayActivityStatus) {
    val (label, containerColor, contentColor) = when (status) {
        DayActivityStatus.COMPLETED -> Triple(
            "DONE",
            DsTheme.colors.actionPrimary.copy(alpha = 0.15f),
            DsTheme.colors.actionPrimary,
        )
        DayActivityStatus.TODAY -> Triple(
            "TODAY",
            DsTheme.colors.actionPrimary.copy(alpha = 0.15f),
            DsTheme.colors.actionPrimary,
        )
        DayActivityStatus.SCHEDULED -> Triple(
            "SCHEDULED",
            DsTheme.colors.surfaceElevated,
            DsTheme.colors.textSecondary,
        )
        DayActivityStatus.MISSED -> Triple(
            "MISSED",
            MaterialTheme.colorScheme.errorContainer,
            MaterialTheme.colorScheme.onErrorContainer,
        )
        DayActivityStatus.REST -> Triple(
            "REST",
            DsTheme.colors.surfaceElevated,
            DsTheme.colors.textSecondary,
        )
    }
    Surface(
        shape = RoundedCornerShape(4.dp),
        color = containerColor,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = contentColor,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}
