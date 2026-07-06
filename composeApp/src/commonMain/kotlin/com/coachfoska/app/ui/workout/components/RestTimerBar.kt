package com.coachfoska.app.ui.workout.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.rest_timer_label
import coachfoska.composeapp.generated.resources.rest_timer_minus30
import coachfoska.composeapp.generated.resources.rest_timer_plus30
import coachfoska.composeapp.generated.resources.rest_timer_skip
import com.coachfoska.app.presentation.workout.RestTimerState
import org.jetbrains.compose.resources.stringResource

@Composable
fun RestTimerBar(
    timerState: RestTimerState,
    onAdjust: (Int) -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val progress = if (timerState.totalSeconds > 0) {
        1f - (timerState.remainingSeconds.toFloat() / timerState.totalSeconds)
    } else 0f

    val minutes = timerState.remainingSeconds / 60
    val seconds = timerState.remainingSeconds % 60
    val timeText = "$minutes:${seconds.toString().padStart(2, '0')}"

    AnimatedVisibility(
        visible = timerState.isActive,
        enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
        exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
        modifier = modifier,
    ) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.inverseSurface,
            tonalElevation = 6.dp,
            shadowElevation = 8.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
        ) {
            Column(modifier = Modifier.padding(start = 20.dp, end = 12.dp, top = 12.dp, bottom = 4.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = stringResource(Res.string.rest_timer_label),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.inverseOnSurface,
                        )
                        Text(
                            text = timeText,
                            style = MaterialTheme.typography.headlineSmall.copy(
                                fontWeight = FontWeight.Bold,
                            ),
                            color = DsTheme.colors.actionPrimary,
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        TextButton(onClick = { onAdjust(-30) }) {
                            Text(
                                text = stringResource(Res.string.rest_timer_minus30),
                                color = MaterialTheme.colorScheme.inversePrimary,
                            )
                        }
                        TextButton(onClick = { onAdjust(30) }) {
                            Text(
                                text = stringResource(Res.string.rest_timer_plus30),
                                color = MaterialTheme.colorScheme.inversePrimary,
                            )
                        }
                        TextButton(onClick = onSkip) {
                            Text(
                                text = stringResource(Res.string.rest_timer_skip),
                                color = MaterialTheme.colorScheme.inversePrimary,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }

                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .padding(horizontal = 4.dp),
                    color = DsTheme.colors.actionPrimary,
                    trackColor = MaterialTheme.colorScheme.inverseSurface.copy(alpha = 0.3f),
                )
            }
        }
    }
}
