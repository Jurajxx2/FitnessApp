package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutDraft
import com.coachfoska.app.domain.model.WorkoutExerciseDraft
import com.coachfoska.app.domain.repository.WorkoutRepository

/**
 * Describes a single exercise swap within a fork operation.
 * The swapped-in exercise records substitution lineage from the exercise it replaces.
 * First-origin wins: if the source exercise already carries a [substitutedFromName], that
 * original name is preserved rather than replaced by an intermediate name.
 */
data class ExerciseSwap(
    val exerciseIndex: Int,
    val newExerciseId: String?,
    val newName: String,
    val newMuscleGroup: String?,
)

class ForkWorkoutUseCase(private val workoutRepository: WorkoutRepository) {
    suspend operator fun invoke(
        userId: String,
        sourceWorkout: Workout,
        swap: ExerciseSwap? = null,
    ): Result<Workout> {
        val exercises = sourceWorkout.exercises.mapIndexed { index, ex ->
            if (swap != null && index == swap.exerciseIndex) {
                WorkoutExerciseDraft(
                    exerciseId = swap.newExerciseId,
                    name = swap.newName,
                    muscleGroup = swap.newMuscleGroup,
                    sets = ex.sets,
                    reps = ex.reps,
                    restSeconds = ex.restSeconds,
                    tips = ex.tips,
                    // First origin wins: preserve original's substituted name if already set.
                    substitutedFromExerciseId = ex.substitutedFromExerciseId ?: ex.exerciseId,
                    substitutedFromName = ex.substitutedFromName ?: ex.name,
                )
            } else {
                WorkoutExerciseDraft(
                    exerciseId = ex.exerciseId,
                    name = ex.name,
                    muscleGroup = ex.muscleGroup,
                    sets = ex.sets,
                    reps = ex.reps,
                    restSeconds = ex.restSeconds,
                    tips = ex.tips,
                    substitutedFromExerciseId = ex.substitutedFromExerciseId,
                    substitutedFromName = ex.substitutedFromName,
                )
            }
        }
        val draft = WorkoutDraft(
            name = sourceWorkout.name,
            dayOfWeek = sourceWorkout.dayOfWeek,
            notes = sourceWorkout.notes,
            exercises = exercises,
        )
        return workoutRepository.createUserWorkout(userId, draft, sourceWorkout.id)
    }
}
