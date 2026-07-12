package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.RecordValue
import com.coachfoska.app.domain.model.SessionPR
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.domain.repository.WorkoutRepository

class CheckPersonalRecordUseCase(
    private val workoutRepository: WorkoutRepository,
    private val calculate1RM: CalculateEstimated1RMUseCase
) {
    suspend operator fun invoke(
        userId: String,
        exerciseName: String,
        weightKg: Float,
        reps: Int
    ): SessionPR? {
        val records = workoutRepository.getExerciseRecords(userId, exerciseName)
            .getOrNull() ?: return null

        val currentHeaviest = (records.heaviestWeight?.value as? RecordValue.Weight)?.kg ?: 0f
        if (weightKg > currentHeaviest) {
            return SessionPR(
                exerciseName = exerciseName,
                record = "${formatWeightKg(weightKg)}kg x $reps"
            )
        }

        val new1RM = calculate1RM(weightKg, reps)
        val current1RM = (records.highestEstimated1RM?.value as? RecordValue.Weight)?.kg ?: 0f
        if (new1RM != null && new1RM > current1RM) {
            return SessionPR(
                exerciseName = exerciseName,
                record = "${formatWeightKg(weightKg)}kg x $reps (1RM: ${formatWeightKg(new1RM)}kg)"
            )
        }

        return null
    }
}
