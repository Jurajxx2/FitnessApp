package com.coachfoska.app.ui.workout.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.session_save_failed
import coachfoska.composeapp.generated.resources.session_saved
import coachfoska.composeapp.generated.resources.session_saving
import com.coachfoska.app.core.util.LocalReduceMotion
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.SetDraft
import com.coachfoska.app.presentation.workout.SetSaveState
import com.coachfoska.app.ui.components.CoachTextField
import org.jetbrains.compose.resources.stringResource

@Composable
fun SetTableHeader(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("SET", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(32.dp))
        Text("PREV", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(64.dp))
        Text("KG", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(56.dp), textAlign = TextAlign.Center)
        Text("REPS", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(48.dp), textAlign = TextAlign.Center)
        Spacer(Modifier.weight(1f))
        Text("✓", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(32.dp), textAlign = TextAlign.Center)
        Text("SAVE", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(76.dp), textAlign = TextAlign.End)
    }
}

@Composable
fun SetRow(
    setDraft: SetDraft,
    previousSetLog: SetLog?,
    isNextSet: Boolean,
    isWarmup: Boolean,
    onWeightChange: (Float?) -> Unit,
    onRepsChange: (Int?) -> Unit,
    onCompleted: () -> Unit,
    onRetrySave: () -> Unit = {},
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

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(completedBg)
            .then(
                if (isNextSet && !setDraft.completed)
                    Modifier.border(1.dp, borderColor, RoundedCornerShape(6.dp))
                else Modifier
            )
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val setLabel = if (isWarmup) "W" else "${setDraft.sortOrder}"
        val setColor = if (isWarmup) Color(0xFFFFC107) else MaterialTheme.colorScheme.onSurface
        Text(
            text = setLabel,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
            color = setColor,
            modifier = Modifier.width(32.dp),
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

        CoachTextField(
            value = setDraft.actualWeightKg?.let { formatWeightKg(it) } ?: "",
            onValueChange = { onWeightChange(it.toFloatOrNull()) },
            label = "",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.width(56.dp),
            singleLine = true,
        )

        CoachTextField(
            value = setDraft.actualReps?.toString() ?: "",
            onValueChange = { onRepsChange(it.toIntOrNull()) },
            label = "",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.width(48.dp),
            singleLine = true,
        )

        Spacer(Modifier.weight(1f))

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
                )
                .clickable {
                    if (!setDraft.completed) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    onCompleted()
                },
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
        SetSaveState.Saved -> Color(0xFF4CAF50)
        SetSaveState.Failed -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = color,
        textAlign = TextAlign.End,
        modifier = modifier
            .then(if (saveState == SetSaveState.Failed) Modifier.clickable(onClick = onRetrySave) else Modifier),
    )
}
