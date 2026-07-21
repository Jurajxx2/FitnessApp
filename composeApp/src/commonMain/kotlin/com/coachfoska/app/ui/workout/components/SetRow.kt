package com.coachfoska.app.ui.workout.components

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.remove_set_cd
import coachfoska.composeapp.generated.resources.set_row_kg_header
import coachfoska.composeapp.generated.resources.set_row_min_header
import coachfoska.composeapp.generated.resources.set_row_prev_header
import coachfoska.composeapp.generated.resources.set_row_reps_header
import coachfoska.composeapp.generated.resources.set_row_set_header
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.SetDraft
import com.coachfoska.app.presentation.workout.SetSaveState
import com.coachfoska.app.presentation.workout.SetType
import com.coachfoska.designsystem.components.DsTextField
import com.coachfoska.designsystem.theme.LocalReduceMotion
import kotlinx.coroutines.delay
import org.jetbrains.compose.resources.stringResource

@Composable
fun SetTableHeader(
    logType: ExerciseLogType,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(stringResource(Res.string.set_row_set_header), style = MaterialTheme.typography.labelSmall, color = DsTheme.colors.textSecondary, modifier = Modifier.width(32.dp))
        Text(stringResource(Res.string.set_row_prev_header), style = MaterialTheme.typography.labelSmall, color = DsTheme.colors.textSecondary, modifier = Modifier.width(64.dp))
        if (logType == ExerciseLogType.WEIGHT_REPS) {
            Text(stringResource(Res.string.set_row_kg_header), style = MaterialTheme.typography.labelSmall, color = DsTheme.colors.textSecondary, modifier = Modifier.width(56.dp), textAlign = TextAlign.Center)
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text = stringResource(
                if (logType == ExerciseLogType.TIME) Res.string.set_row_min_header
                else Res.string.set_row_reps_header,
            ),
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.textSecondary,
            modifier = Modifier.width(
                when (logType) {
                    ExerciseLogType.WEIGHT_REPS -> 48.dp
                    ExerciseLogType.TIME -> 112.dp
                    ExerciseLogType.BODYWEIGHT_REPS -> 64.dp
                }
            ),
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.weight(1f))
        Text("✓", style = MaterialTheme.typography.labelSmall, color = DsTheme.colors.textSecondary, modifier = Modifier.width(DsTheme.sizes.touchTarget), textAlign = TextAlign.Center)
        Spacer(Modifier.width(DsTheme.sizes.touchTarget))
    }
}

@Composable
fun SetRow(
    setDraft: SetDraft,
    logType: ExerciseLogType,
    targetDurationSeconds: Int? = null,
    previousSetLog: SetLog?,
    isNextSet: Boolean,
    onWeightChange: (Float?) -> Unit,
    onRepsChange: (Int?) -> Unit,
    onDurationChange: (Int?) -> Unit = {},
    onCompleted: () -> Unit,
    onSetTypeChange: (SetType) -> Unit = {},
    onRemove: (() -> Unit)? = null,
    onRetrySave: () -> Unit = {},
    onNextAfterReps: () -> Unit = {},
    weightFocusRequester: FocusRequester = FocusRequester(),
    repsFocusRequester: FocusRequester = FocusRequester(),
    modifier: Modifier = Modifier,
) {
    val reduceMotion = LocalReduceMotion.current
    val haptics = LocalHapticFeedback.current
    val pulse = remember { Animatable(1f) }
    var elapsedSeconds by remember(setDraft.setLogId, setDraft.sortOrder) {
        mutableStateOf(setDraft.actualDurationSeconds ?: setDraft.actualRestSeconds ?: 0)
    }
    var isTimerRunning by remember(setDraft.setLogId, setDraft.sortOrder) {
        mutableStateOf(false)
    }
    LaunchedEffect(setDraft.completed) {
        if (setDraft.completed) {
            isTimerRunning = false
        }
        if (setDraft.completed && !reduceMotion) {
            pulse.snapTo(1.15f)
            pulse.animateTo(1f, animationSpec = tween(180))
        } else {
            pulse.snapTo(1f)
        }
    }
    LaunchedEffect(setDraft.actualDurationSeconds, setDraft.actualRestSeconds, isTimerRunning) {
        // Older timed logs used actual_rest_seconds before duration was given its own column.
        val savedSeconds = setDraft.actualDurationSeconds ?: setDraft.actualRestSeconds
        if (!isTimerRunning && savedSeconds != null && savedSeconds != elapsedSeconds) {
            elapsedSeconds = savedSeconds
        }
    }
    LaunchedEffect(isTimerRunning, setDraft.completed) {
        while (isTimerRunning && !setDraft.completed) {
            delay(1000)
            elapsedSeconds += 1
            onDurationChange(elapsedSeconds)
        }
    }
    val completedBg by animateColorAsState(
        targetValue = if (setDraft.completed) DsTheme.colors.actionPrimary.copy(alpha = 0.12f)
        else Color.Transparent,
        animationSpec = tween(200),
        label = "setRowBg",
    )
    val borderColor = when {
        isNextSet && !setDraft.completed -> DsTheme.colors.actionPrimary
        else -> Color.Transparent
    }

    // --- Set type display ---
    val setLabel = when (setDraft.setType) {
        SetType.NORMAL -> "${setDraft.sortOrder}"
        SetType.WARMUP -> "W"
        SetType.DROP_SET -> "D"
        SetType.FAILURE -> "F"
    }
    val setColor = when (setDraft.setType) {
        SetType.NORMAL -> DsTheme.colors.textPrimary
        SetType.WARMUP -> DsTheme.colors.warning
        SetType.DROP_SET -> DsTheme.colors.warningStrong
        SetType.FAILURE -> DsTheme.colors.error // red
    }
    val saveFailed = setDraft.saveState == SetSaveState.Failed

    // Fitts's Law: entire row is a tap target to mark set complete
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(completedBg)
            .then(
                if (isNextSet && !setDraft.completed)
                    Modifier.border(1.dp, borderColor, RoundedCornerShape(6.dp))
                else Modifier
            )
            .clickable {
                if (setDraft.completed || setDraft.canComplete(logType)) {
                    if (!setDraft.completed) {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    }
                    onCompleted()
                }
            }
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Set number / type label — tap to cycle set type
        Text(
            text = setLabel,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
            color = setColor,
            modifier = Modifier
                .width(32.dp)
                .clickable {
                    val nextType = when (setDraft.setType) {
                        SetType.NORMAL -> SetType.WARMUP
                        SetType.WARMUP -> SetType.DROP_SET
                        SetType.DROP_SET -> SetType.FAILURE
                        SetType.FAILURE -> SetType.NORMAL
                    }
                    onSetTypeChange(nextType)
                },
        )

        val prevText = previousSetLog?.formatFor(logType) ?: "-"
        Text(
            text = prevText,
            style = MaterialTheme.typography.bodySmall,
            color = DsTheme.colors.textSecondary,
            modifier = Modifier.width(64.dp),
        )

        if (logType == ExerciseLogType.WEIGHT_REPS) {
            DsTextField(
                value = setDraft.actualWeightKg?.let { formatWeightKg(it) } ?: "",
                onValueChange = { onWeightChange(it.toFloatOrNull()) },
                label = "",
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Decimal,
                    imeAction = ImeAction.Next,
                ),
                keyboardActions = KeyboardActions(
                    onNext = { repsFocusRequester.requestFocus() },
                ),
                modifier = Modifier
                    .width(56.dp)
                    .focusRequester(weightFocusRequester),
                singleLine = true,
            )
            Spacer(Modifier.width(8.dp))
        }

        if (logType == ExerciseLogType.TIME) {
            TimeTrackerCell(
                elapsedSeconds = elapsedSeconds,
                targetDurationSeconds = targetDurationSeconds,
                isRunning = isTimerRunning,
                enabled = !setDraft.completed,
                onToggle = {
                    isTimerRunning = !isTimerRunning
                    if (!isTimerRunning) {
                        onDurationChange(elapsedSeconds.takeIf { it > 0 })
                    }
                },
            )
        } else {
            DsTextField(
                value = setDraft.actualReps?.toString() ?: "",
                onValueChange = { onRepsChange(it.toIntOrNull()) },
                label = "",
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Number,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(
                    onDone = { onNextAfterReps() },
                ),
                modifier = Modifier
                    .width(if (logType == ExerciseLogType.WEIGHT_REPS) 48.dp else 64.dp)
                    .focusRequester(repsFocusRequester),
                singleLine = true,
            )
        }

        Spacer(Modifier.weight(1f))

        // 48dp outer box is the touch target; 32dp inner box is the visual element.
        Box(
            modifier = Modifier
                .size(DsTheme.sizes.touchTarget)
                .clickable {
                    if (saveFailed) {
                        onRetrySave()
                    } else if (setDraft.completed || setDraft.canComplete(logType)) {
                        if (logType == ExerciseLogType.TIME) {
                            isTimerRunning = false
                            onDurationChange(elapsedSeconds.takeIf { it > 0 })
                        }
                        if (!setDraft.completed) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        onCompleted()
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .graphicsLayer {
                        scaleX = pulse.value
                        scaleY = pulse.value
                    }
                    .clip(RoundedCornerShape(6.dp))
                    .background(
                        when {
                            saveFailed -> DsTheme.colors.error
                            setDraft.completed -> DsTheme.colors.actionPrimary
                            else -> DsTheme.colors.surfaceElevated
                        }
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = when {
                        saveFailed -> "!"
                        setDraft.completed -> "✓"
                        else -> ""
                    },
                    color = if (saveFailed || setDraft.completed) {
                        DsTheme.colors.onActionPrimary
                    } else {
                        DsTheme.colors.textSecondary
                    },
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
            }
        }

        IconButton(
            onClick = { onRemove?.invoke() },
            enabled = onRemove != null,
            modifier = Modifier.size(DsTheme.sizes.touchTarget),
        ) {
            Icon(
                imageVector = Icons.Default.DeleteOutline,
                contentDescription = stringResource(Res.string.remove_set_cd),
                tint = if (onRemove != null) {
                    DsTheme.colors.textSecondary
                } else {
                    DsTheme.colors.textSecondary.copy(alpha = 0.24f)
                },
            )
        }
    }
}

@Composable
private fun TimeTrackerCell(
    elapsedSeconds: Int,
    targetDurationSeconds: Int?,
    isRunning: Boolean,
    enabled: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.width(112.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        IconButton(
            onClick = onToggle,
            enabled = enabled,
            modifier = Modifier.size(40.dp),
        ) {
            Icon(
                imageVector = if (isRunning) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = null,
                tint = if (enabled) DsTheme.colors.actionPrimary else DsTheme.colors.textSecondary.copy(alpha = 0.35f),
            )
        }
        Text(
            text = targetDurationSeconds?.let { target ->
                "${formatElapsedTime(elapsedSeconds)} / ${formatElapsedTime(target)}"
            } ?: formatElapsedTime(elapsedSeconds),
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            color = DsTheme.colors.textPrimary,
            modifier = Modifier.width(68.dp),
            textAlign = TextAlign.Center,
        )
    }
}

private fun SetDraft.canComplete(logType: ExerciseLogType): Boolean = when (logType) {
    ExerciseLogType.WEIGHT_REPS -> actualWeightKg != null && actualReps != null
    ExerciseLogType.BODYWEIGHT_REPS -> actualReps != null
    ExerciseLogType.TIME -> actualDurationSeconds != null || actualRestSeconds != null
}

private fun SetLog.formatFor(logType: ExerciseLogType): String = when (logType) {
    ExerciseLogType.WEIGHT_REPS -> {
        val weight = actualWeightKg?.let { formatWeightKg(it) } ?: "?"
        val reps = actualReps?.toString() ?: "?"
        "$weight x $reps"
    }
    ExerciseLogType.BODYWEIGHT_REPS -> actualReps?.let { "$it reps" } ?: "-"
    ExerciseLogType.TIME -> (actualDurationSeconds ?: actualRestSeconds)?.let { formatElapsedTime(it) } ?: "-"
}

private fun formatElapsedTime(seconds: Int): String {
    val minutes = seconds / 60
    val remainingSeconds = seconds % 60
    return "${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}"
}
