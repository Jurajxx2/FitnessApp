package com.coachfoska.app.ui.workout.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.common_more_options_cd
import coachfoska.composeapp.generated.resources.finish_button_label
import coachfoska.composeapp.generated.resources.session_discard
import coachfoska.composeapp.generated.resources.workout_title_hint
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.SessionDraft
import org.jetbrains.compose.resources.stringResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionHeaderBar(
    draft: SessionDraft?,
    elapsedSeconds: Long,
    onBackClick: () -> Unit,
    onFinishClick: () -> Unit,
    onDiscardClick: () -> Unit,
    modifier: Modifier = Modifier,
    onWorkoutNameChange: (String) -> Unit = {},
) {
    var menuExpanded by remember { mutableStateOf(false) }
    val minutes = elapsedSeconds / 60
    val seconds = elapsedSeconds % 60
    val timerText = "$minutes:${seconds.toString().padStart(2, '0')}"

    val totalVolume = draft?.exercises?.sumOf { ex ->
        ex.sets.filter { it.completed }.sumOf { s ->
            ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
        }
    }?.toFloat() ?: 0f
    val volumeText = if (totalVolume >= 1000f) {
        "${formatWeightKg(totalVolume / 1000f)}t"
    } else {
        "${formatWeightKg(totalVolume)}kg"
    }

    val titleHint = stringResource(Res.string.workout_title_hint)
    var textFieldValue by remember(draft?.workoutName) {
        mutableStateOf(TextFieldValue(draft?.workoutName?.uppercase() ?: ""))
    }

    TopAppBar(
        title = {
            Column {
                // Editable workout title
                BasicTextField(
                    value = textFieldValue,
                    onValueChange = { newValue ->
                        val uppercased = newValue.copy(text = newValue.text.uppercase())
                        textFieldValue = uppercased
                        onWorkoutNameChange(uppercased.text)
                    },
                    singleLine = true,
                    textStyle = TextStyle(
                        color = DsTheme.colors.textPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = MaterialTheme.typography.titleMedium.fontSize,
                        letterSpacing = MaterialTheme.typography.titleMedium.letterSpacing,
                    ),
                    cursorBrush = SolidColor(DsTheme.colors.actionPrimary),
                    decorationBox = { innerTextField ->
                        Box {
                            if (textFieldValue.text.isEmpty()) {
                                Text(
                                    text = titleHint,
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                    ),
                                    color = DsTheme.colors.textSecondary.copy(alpha = 0.5f),
                                )
                            }
                            innerTextField()
                        }
                    },
                )

                // Timer and volume stats row
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = timerText,
                        style = MaterialTheme.typography.labelMedium,
                        color = DsTheme.colors.actionPrimary,
                    )
                    Text(
                        text = "·",
                        style = MaterialTheme.typography.labelMedium,
                        color = DsTheme.colors.textSecondary,
                    )
                    Text(
                        text = volumeText,
                        style = MaterialTheme.typography.labelMedium,
                        color = DsTheme.colors.textSecondary,
                    )
                }
            }
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(Res.string.back_cd))
            }
        },
        actions = {
            // Prominent Finish button
            FilledTonalButton(
                onClick = onFinishClick,
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 0.dp),
                modifier = Modifier.height(36.dp),
            ) {
                Text(
                    text = stringResource(Res.string.finish_button_label),
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            // Overflow menu — only Discard
            Box {
                IconButton(onClick = { menuExpanded = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = stringResource(Res.string.common_more_options_cd))
                }
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = { Text(stringResource(Res.string.session_discard), color = DsTheme.colors.error) },
                        onClick = { menuExpanded = false; onDiscardClick() },
                    )
                }
            }
        },
        modifier = modifier,
        windowInsets = WindowInsets(0),
    )
}
