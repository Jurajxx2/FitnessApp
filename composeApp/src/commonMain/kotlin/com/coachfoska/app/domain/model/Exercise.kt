package com.coachfoska.app.domain.model

data class Exercise(
    val id: String,
    val name: String,
    val description: String,
    val category: ExerciseCategory?,
    val muscles: List<String>,
    val musclesSecondary: List<String>,
    val equipment: List<String>,
    val imageUrl: String?,
    val videoUrl: String?,
    val difficulty: String?
)

data class ExerciseCategory(
    val id: Int,
    val name: String
)
