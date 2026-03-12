package com.coachfoska.app.domain.model

/**
 * Exercise from WGER public exercise API.
 * Used for browsing and searching exercises library.
 */
data class WgerExercise(
    val id: Int,
    val name: String,
    val description: String,
    val category: ExerciseCategory?,
    val muscles: List<Muscle>,
    val musclesSecondary: List<Muscle>,
    val equipment: List<Equipment>,
    val imageUrl: String?
)

data class ExerciseCategory(
    val id: Int,
    val name: String
)

data class Muscle(
    val id: Int,
    val name: String,
    val isFront: Boolean
)

data class Equipment(
    val id: Int,
    val name: String
)
