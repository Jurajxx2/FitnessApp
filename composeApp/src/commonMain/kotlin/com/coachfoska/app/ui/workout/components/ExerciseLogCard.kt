package com.coachfoska.app.ui.workout.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.add_set
import coachfoska.composeapp.generated.resources.exercise_preview_cd
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.SessionPR
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.presentation.workout.ActiveSessionIntent
import com.coachfoska.app.presentation.workout.ExerciseDraft
import com.coachfoska.app.presentation.workout.RestTimerState
import com.coachfoska.app.presentation.workout.canComplete
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsButtonVariant
import com.coachfoska.app.ui.workout.AnimatedImageMode
import com.coachfoska.app.ui.workout.ExerciseAnimatedImage
import com.coachfoska.app.ui.workout.ExerciseFigureVariant
import com.coachfoska.app.ui.workout.ExerciseLottiePreview
import com.coachfoska.app.ui.workout.animatedImageMode
import com.coachfoska.app.ui.workout.hasExerciseLottiePreview
import com.coachfoska.app.ui.workout.lottieJsonFor
import org.jetbrains.compose.resources.stringResource

/**
 * A single exercise section in the active-session list: header with an optional animated thumbnail,
 * coaching tip, PR banner, and the full set table with prefilled inputs. All exercises are shown at
 * once so the user just scrolls through the workout.
 */
@Composable
fun ExerciseLogCard(
    exercise: ExerciseDraft,
    exerciseIndex: Int,
    previousSets: List<SetLog>,
    prBanner: SessionPR?,
    restTimer: RestTimerState,
    onIntent: (ActiveSessionIntent) -> Unit,
    onSwapClick: () -> Unit,
    onExerciseDetailClick: (exerciseId: String?, exerciseName: String) -> Unit,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (exerciseIndex > 0) {
            HorizontalDivider(
                modifier = Modifier.padding(horizontal = 2.dp),
                color = DsTheme.colors.outlineSubtle,
                thickness = 1.dp,
            )
        }

        Column(
            modifier = Modifier.padding(top = if (exerciseIndex > 0) 8.dp else 0.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                val figureVariant = ExerciseFigureVariant.Man
                val databaseLottieJson = exercise.lottieAnimations.lottieJsonFor(figureVariant)
                val hasLottiePreview = databaseLottieJson != null ||
                    exercise.animationUrl != null ||
                    hasExerciseLottiePreview(exercise.exerciseName)
                val imageMode = animatedImageMode(exercise.imageUrl, exercise.imageUrl2)
                val previewCd = stringResource(Res.string.exercise_preview_cd)
                ExerciseCardHeader(
                    exercise = exercise,
                    onSwapExercise = onSwapClick,
                    onViewHistory = { onExerciseDetailClick(exercise.exerciseId, exercise.exerciseName) },
                    onMoveUp = {
                        onIntent(ActiveSessionIntent.MoveExercise(exerciseIndex, direction = -1))
                    },
                    onMoveDown = {
                        onIntent(ActiveSessionIntent.MoveExercise(exerciseIndex, direction = 1))
                    },
                    canMoveUp = canMoveUp,
                    canMoveDown = canMoveDown,
                    leading = if (hasLottiePreview || imageMode != AnimatedImageMode.NONE) {
                        {
                            if (hasLottiePreview) {
                                ExerciseLottiePreview(
                                    exerciseName = exercise.exerciseName,
                                    animationJson = databaseLottieJson,
                                    animationUrl = exercise.animationUrl,
                                    figureVariant = figureVariant,
                                    contentDescription = previewCd,
                                    modifier = Modifier
                                        .size(56.dp)
                                        .clickable { onExerciseDetailClick(exercise.exerciseId, exercise.exerciseName) },
                                )
                            } else {
                                ExerciseAnimatedImage(
                                    startUrl = exercise.imageUrl,
                                    endUrl = exercise.imageUrl2,
                                    contentDescription = previewCd,
                                    modifier = Modifier
                                        .size(56.dp)
                                        .clickable { onExerciseDetailClick(exercise.exerciseId, exercise.exerciseName) },
                                )
                            }
                        }
                    } else {
                        null
                    },
                )

                exercise.tips?.let { tips ->
                    Text(
                        text = tips,
                        style = MaterialTheme.typography.bodySmall,
                        color = DsTheme.colors.textSecondary,
                    )
                }

                PRBanner(pr = prBanner)
            }

            val firstIncompleteIndex = exercise.sets.indexOfFirst { !it.completed }
            val weightFocusRequesters = remember(exercise.sets.size) {
                List(exercise.sets.size) { FocusRequester() }
            }
            val repsFocusRequesters = remember(exercise.sets.size) {
                List(exercise.sets.size) { FocusRequester() }
            }

            Column(
                modifier = Modifier.padding(horizontal = 6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                SetTableHeader(logType = exercise.logType)
                HorizontalDivider()
                exercise.sets.forEachIndexed { setIndex, setDraft ->
                    SetRow(
                        setDraft = setDraft,
                        logType = exercise.logType,
                        targetDurationSeconds = exercise.targetDurationSeconds,
                        previousSetLog = previousSets.getOrNull(setIndex),
                        isNextSet = setIndex == firstIncompleteIndex,
                        onWeightChange = { weight ->
                            onIntent(ActiveSessionIntent.UpdateSetActual(exerciseIndex, setIndex, setDraft.actualReps, weight))
                        },
                        onRepsChange = { reps ->
                            onIntent(ActiveSessionIntent.UpdateSetActual(exerciseIndex, setIndex, reps, setDraft.actualWeightKg))
                        },
                        onStartTimer = {
                            onIntent(ActiveSessionIntent.StartSetTimer(exerciseIndex, setIndex))
                        },
                        onPauseTimer = {
                            onIntent(ActiveSessionIntent.PauseSetTimer(exerciseIndex, setIndex))
                        },
                        onCompleted = {
                            onIntent(ActiveSessionIntent.MarkSetComplete(exerciseIndex, setIndex, !setDraft.completed))
                        },
                        onSetTypeChange = { newType ->
                            onIntent(ActiveSessionIntent.ChangeSetType(exerciseIndex, setIndex, newType))
                        },
                        onRemove = if (exercise.sets.size > 1) {
                            { onIntent(ActiveSessionIntent.RemoveSet(exerciseIndex, setIndex)) }
                        } else {
                            null
                        },
                        onRetrySave = {
                            onIntent(ActiveSessionIntent.RetrySetSave(exerciseIndex, setIndex))
                        },
                        onNextAfterReps = {
                            if (!setDraft.completed && setDraft.canComplete(exercise.logType)) {
                                onIntent(ActiveSessionIntent.MarkSetComplete(exerciseIndex, setIndex, true))
                            }
                            if (setIndex + 1 < exercise.sets.size) {
                                try {
                                    weightFocusRequesters[setIndex + 1].requestFocus()
                                } catch (e: Exception) {
                                    // Ignore focus errors
                                }
                            }
                        },
                        weightFocusRequester = weightFocusRequesters[setIndex],
                        repsFocusRequester = repsFocusRequesters[setIndex],
                    )
                    if (
                        restTimer.isActive &&
                        restTimer.exerciseIndex == exerciseIndex &&
                        restTimer.setIndex == setIndex
                    ) {
                        RestTimerBar(
                            timerState = restTimer,
                            onAdjust = { onIntent(ActiveSessionIntent.AdjustRestTimer(it)) },
                            onSkip = { onIntent(ActiveSessionIntent.SkipRestTimer) },
                            modifier = Modifier.padding(vertical = 4.dp),
                        )
                    }
                }
            }

            DsButton(
                text = stringResource(Res.string.add_set),
                onClick = { onIntent(ActiveSessionIntent.AddExtraSet(exerciseIndex)) },
                modifier = Modifier
                    .padding(horizontal = 14.dp)
                    .fillMaxWidth(),
                variant = DsButtonVariant.Outlined,
            )
        }
    }
}
