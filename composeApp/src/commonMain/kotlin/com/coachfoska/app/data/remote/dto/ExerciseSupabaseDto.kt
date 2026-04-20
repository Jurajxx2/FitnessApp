package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
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
    @SerialName("primary_muscles") val primaryMuscles: List<String> = emptyList(),
    @SerialName("secondary_muscles") val secondaryMuscles: List<String> = emptyList(),
    @SerialName("equipment_names") val equipmentNames: List<String> = emptyList(),
    @SerialName("exercise_categories") val category: ExerciseCategoryDto? = null,
) {
    fun toDomain(locale: String = "en"): Exercise {
        val name = if (locale == "cs" && !nameCsRaw.isNullOrBlank()) nameCsRaw else nameEn
        val description = if (locale == "cs" && !descriptionCsRaw.isNullOrBlank()) descriptionCsRaw else descriptionEn
        return Exercise(
            id = id,
            name = name,
            description = description,
            category = category?.toDomain(),
            muscles = primaryMuscles,
            musclesSecondary = secondaryMuscles,
            equipment = equipmentNames,
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
