package com.coachfoska.app.ui.workout

import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.editor_log_type_bodyweight
import coachfoska.composeapp.generated.resources.editor_log_type_time
import coachfoska.composeapp.generated.resources.editor_log_type_weight_reps
import com.coachfoska.app.domain.model.ExerciseLogType
import org.jetbrains.compose.resources.StringResource

/**
 * Log-type toggle options and their labels, shared by the workout editor (coach plan builder) and
 * the manual log screen so the two tracking-type selectors never drift apart.
 */
internal val LOG_TYPE_OPTIONS = listOf(
    ExerciseLogType.WEIGHT_REPS,
    ExerciseLogType.BODYWEIGHT_REPS,
    ExerciseLogType.TIME,
)

internal fun ExerciseLogType.labelRes(): StringResource = when (this) {
    ExerciseLogType.WEIGHT_REPS -> Res.string.editor_log_type_weight_reps
    ExerciseLogType.BODYWEIGHT_REPS -> Res.string.editor_log_type_bodyweight
    ExerciseLogType.TIME -> Res.string.editor_log_type_time
}
