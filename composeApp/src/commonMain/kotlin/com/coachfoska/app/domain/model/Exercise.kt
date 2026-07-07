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
    val imageUrl2: String?,
    val videoUrl: String?,
    val difficulty: String?,
    val logType: ExerciseLogType = inferExerciseLogType(
        name = name,
        categoryName = category?.name,
        equipment = equipment,
    ),
)

data class ExerciseCategory(
    val id: Int,
    val name: String
)

enum class ExerciseLogType {
    WEIGHT_REPS,
    BODYWEIGHT_REPS,
    TIME,
}

fun inferExerciseLogType(
    name: String,
    categoryName: String? = null,
    equipment: List<String> = emptyList(),
    reps: String? = null,
): ExerciseLogType {
    val haystack = buildString {
        append(name.lowercase())
        categoryName?.let { append(' ').append(it.lowercase()) }
        reps?.let { append(' ').append(it.lowercase()) }
        equipment.forEach { append(' ').append(it.lowercase()) }
    }

    val timeSignals = listOf(
        "run", "running", "jog", "sprint", "walk", "bike", "cycling", "row", "rowing",
        "swim", "plank", "hold", "carry", "stretch", "cardio", "time", "min", "sec",
        "běh", "chůze", "kolo", "plank", "výdrž", "protažení",
    )
    if (timeSignals.any { it in haystack }) return ExerciseLogType.TIME

    val weightedEquipment = listOf(
        "barbell", "dumbbell", "kettlebell", "machine", "cable", "smith", "plate",
        "ez bar", "trap bar", "medicine ball", "činka", "kladka", "stroj",
    )
    if (weightedEquipment.any { it in haystack }) return ExerciseLogType.WEIGHT_REPS

    val bodyweightSignals = listOf(
        "push-up", "pushup", "pull-up", "pullup", "chin-up", "chinup", "dip", "burpee",
        "crunch", "sit-up", "squat jump", "lunge jump", "mountain climber",
        "bodyweight", "calisthenics", "no equipment", "none", "vlastní váha", "bez vybavení",
        "klik", "shyb", "dip",
    )
    if (bodyweightSignals.any { it in haystack }) return ExerciseLogType.BODYWEIGHT_REPS

    return ExerciseLogType.WEIGHT_REPS
}
