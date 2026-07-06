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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
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
import coachfoska.composeapp.generated.resources.session_save_failed
import coachfoska.composeapp.generated.resources.session_saved
import coachfoska.composeapp.generated.resources.session_saving
import coachfoska.composeapp.generated.resources.remove_set_cd
import coachfoska.composeapp.generated.resources.set_row_kg_header
import coachfoska.composeapp.generated.resources.set_row_prev_header
import coachfoska.composeapp.generated.resources.set_row_reps_header
import coachfoska.composeapp.generated.resources.set_row_save_header
import coachfoska.composeapp.generated.resources.set_row_set_header
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.SetDraft
import com.coachfoska.app.presentation.workout.SetSaveState
import com.coachfoska.app.presentation.workout.SetType
import com.coachfoska.designsystem.components.DsTextField
import com.coachfoska.designsystem.theme.LocalReduceMotion
import org.jetbrains.compose.resources.stringResource

@Composable
fun SetTableHeader(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(stringResource(Res.string.set_row_set_header), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(32.dp))
        Text(stringResource(Res.string.set_row_prev_header), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(64.dp))
        Text(stringResource(Res.string.set_row_kg_header), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(56.dp), textAlign = TextAlign.Center)
        Text(stringResource(Res.string.set_row_reps_header), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(48.dp), textAlign = TextAlign.Center)
        Spacer(Modifier.weight(1f))
        Text("✓", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(DsTheme.sizes.touchTarget), textAlign = TextAlign.Center)
        Spacer(Modifier.width(DsTheme.sizes.touchTarget))
        Text(stringResource(Res.string.set_row_save_header), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(76.dp), textAlign = TextAlign.End)
    }
}

@Composable
fun SetRow(
    setDraft: SetDraft,
    previousSetLog: SetLog?,
    isNextSet: Boolean,
    onWeightChange: (Float?) -> Unit,
    onRepsChange: (Int?) -> Unit,
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
    LaunchedEffect(setDraft.completed) {
        if (setDraft.completed && !reduceMotion) {
            pulse.snapTo(1.15f)
            pulse.animateTo(1f, animationSpec = tween(180))
        } else {
            pulse.snapTo(1f)
        }
    }
    val completedBg by animateColorAsState(
        targetValue = if (setDraft.completed) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
        else Color.Transparent,
        animationSpec = tween(200),
        label = "setRowBg",
    )
    val borderColor = when {
        isNextSet && !setDraft.completed -> MaterialTheme.colorScheme.primary
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
        SetType.NORMAL -> MaterialTheme.colorScheme.onSurface
        SetType.WARMUP -> DsTheme.colors.warning
        SetType.DROP_SET -> DsTheme.colors.warningStrong
        SetType.FAILURE -> MaterialTheme.colorScheme.error // red
    }

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
                // Only mark done when both fields are filled; text fields consume
                // their own taps so this won't fire when editing.
                val hasBothValues = setDraft.actualWeightKg != null && setDraft.actualReps != null
                if (hasBothValues) {
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

        val prevText = previousSetLog?.let { prev ->
            val w = prev.actualWeightKg?.let { formatWeightKg(it) } ?: "?"
            val r = prev.actualReps?.toString() ?: "?"
            "$w x $r"
        } ?: "-"
        Text(
            text = prevText,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(64.dp),
        )

        // Weight input — ImeAction.Next moves focus to reps field
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

        // Reps input — ImeAction.Done triggers onNextAfterReps callback
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
                .width(48.dp)
                .focusRequester(repsFocusRequester),
            singleLine = true,
        )

        Spacer(Modifier.weight(1f))

        // 48dp outer box is the touch target; 32dp inner box is the visual element.
        Box(
            modifier = Modifier
                .size(DsTheme.sizes.touchTarget)
                .clickable {
                    if (!setDraft.completed) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    onCompleted()
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
                        if (setDraft.completed) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.surfaceVariant
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = if (setDraft.completed) "✓" else "",
                    color = if (setDraft.completed) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
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
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.24f)
                },
            )
        }

        SetSaveStateLabel(
            saveState = setDraft.saveState,
            onRetrySave = onRetrySave,
            modifier = Modifier.width(76.dp),
        )
    }
}

@Composable
private fun SetSaveStateLabel(
    saveState: SetSaveState,
    onRetrySave: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val text = when (saveState) {
        SetSaveState.Idle -> ""
        SetSaveState.Saving -> stringResource(Res.string.session_saving)
        SetSaveState.Saved -> stringResource(Res.string.session_saved)
        SetSaveState.Failed -> stringResource(Res.string.session_save_failed)
    }
    val color = when (saveState) {
        SetSaveState.Saved -> DsTheme.colors.successSoft
        SetSaveState.Failed -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = color,
        textAlign = TextAlign.End,
        modifier = modifier
            .heightIn(min = DsTheme.sizes.touchTarget)
            .then(if (saveState == SetSaveState.Failed) Modifier.clickable(onClick = onRetrySave) else Modifier),
    )
}
