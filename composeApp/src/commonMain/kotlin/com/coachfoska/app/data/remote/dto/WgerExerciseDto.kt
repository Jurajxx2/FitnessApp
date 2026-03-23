package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.Equipment
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.model.Muscle
import com.coachfoska.app.domain.model.WgerExercise
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Response wrapper for WGER list endpoints */
@Serializable
data class WgerListResponse<T>(
    val count: Int,
    val next: String? = null,
    val previous: String? = null,
    val results: List<T>
)

/** WGER exercise info endpoint response (includes translations and images) */
@Serializable
data class WgerExerciseInfoDto(
    val id: Int,
    val category: WgerCategoryDto? = null,
    val muscles: List<WgerMuscleDto> = emptyList(),
    @SerialName("muscles_secondary") val musclesSecondary: List<WgerMuscleDto> = emptyList(),
    val equipment: List<WgerEquipmentDto> = emptyList(),
    val translations: List<WgerTranslationDto> = emptyList(),
    val images: List<WgerImageDto> = emptyList(),
    val videos: List<WgerVideoDto> = emptyList()
) {
    fun toDomain(): WgerExercise {
        val englishTranslation = translations.firstOrNull { it.language == 2 }
            ?: translations.firstOrNull()
        return WgerExercise(
            id = id,
            name = englishTranslation?.name ?: "Exercise $id",
            description = englishTranslation?.description?.let { stripHtmlTags(it) } ?: "",
            category = category?.toDomain(),
            muscles = muscles.map { it.toDomain(isFront = true) },
            musclesSecondary = musclesSecondary.map { it.toDomain(isFront = false) },
            equipment = equipment.map { it.toDomain() },
            imageUrl = images.firstOrNull()?.image,
            videoUrl = videos.firstOrNull()?.video
        )
    }
}

@Serializable
data class WgerCategoryDto(
    val id: Int,
    val name: String
) {
    fun toDomain(): ExerciseCategory = ExerciseCategory(id = id, name = name)
}

@Serializable
data class WgerMuscleDto(
    val id: Int,
    @SerialName("name_en") val nameEn: String,
    @SerialName("is_front") val isFront: Boolean = true
) {
    fun toDomain(isFront: Boolean): Muscle = Muscle(id = id, name = nameEn, isFront = isFront)
}

@Serializable
data class WgerEquipmentDto(
    val id: Int,
    val name: String
) {
    fun toDomain(): Equipment = Equipment(id = id, name = name)
}

@Serializable
data class WgerTranslationDto(
    val id: Int,
    val language: Int,
    val name: String,
    val description: String = ""
)

@Serializable
data class WgerImageDto(
    val id: Int,
    val image: String,
    @SerialName("is_main") val isMain: Boolean = false
)

@Serializable
data class WgerVideoDto(
    val id: Int,
    val video: String,
    @SerialName("is_main") val isMain: Boolean = false
)

/** Simple search result from /api/v2/exercise/?format=json */
@Serializable
data class WgerExerciseSearchDto(
    val id: Int,
    val uuid: String = "",
    val name: String = ""
)

private fun stripHtmlTags(html: String): String =
    html.replace(Regex("<[^>]*>"), "").trim()
