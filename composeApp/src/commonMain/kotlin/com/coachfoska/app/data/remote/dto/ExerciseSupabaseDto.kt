package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.Equipment
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.model.Muscle
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ExerciseDto(
    val id: String,
    @SerialName("name_en") val nameEn: String,
    @SerialName("description_en") val descriptionEn: String = "",
    @SerialName("name_cs") val nameCsRaw: String? = null,
    @SerialName("description_cs") val descriptionCsRaw: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    val difficulty: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("exercise_categories") val category: ExerciseCategoryDto? = null,
    @SerialName("exercise_muscles") val exerciseMuscles: List<ExerciseMuscleDto> = emptyList(),
    @SerialName("exercise_equipment") val exerciseEquipment: List<ExerciseEquipmentDto> = emptyList()
) {
    fun toDomain(locale: String = "en"): Exercise {
        val name = if (locale == "cs" && !nameCsRaw.isNullOrBlank()) nameCsRaw else nameEn
        val description = if (locale == "cs" && !descriptionCsRaw.isNullOrBlank()) descriptionCsRaw else descriptionEn
        return Exercise(
            id = id,
            name = name,
            description = description,
            category = category?.toDomain(),
            muscles = exerciseMuscles.filter { it.isPrimary }.mapNotNull { it.muscle?.toDomain() },
            musclesSecondary = exerciseMuscles.filter { !it.isPrimary }.mapNotNull { it.muscle?.toDomain() },
            equipment = exerciseEquipment.mapNotNull { it.equipment?.toDomain() },
            imageUrl = imageUrl,
            videoUrl = videoUrl,
            difficulty = difficulty
        )
    }
}

@Serializable
data class ExerciseCategoryDto(
    val id: Int,
    val name: String
) {
    fun toDomain() = ExerciseCategory(id = id, name = name)
}

@Serializable
data class ExerciseMuscleDto(
    @SerialName("is_primary") val isPrimary: Boolean = true,
    val muscles: MuscleDto? = null
) {
    // Supabase returns the joined row under the FK table name "muscles"
    val muscle: MuscleDto? get() = muscles
}

@Serializable
data class MuscleDto(
    val id: Int,
    val name: String,
    @SerialName("is_front") val isFront: Boolean = true
) {
    fun toDomain() = Muscle(id = id, name = name, isFront = isFront)
}

@Serializable
data class ExerciseEquipmentDto(
    val equipment: EquipmentDto? = null
)

@Serializable
data class EquipmentDto(
    val id: Int,
    val name: String
) {
    fun toDomain() = Equipment(id = id, name = name)
}
