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
    val haystack = buildList {
        add(name)
        categoryName?.let(::add)
        reps?.let(::add)
        addAll(equipment)
    }.joinToString(" ") { it.normalizedForLogTypeSearch() }
    val paddedHaystack = " $haystack "

    val bodyweightRepsOverrides = listOf(
        "ab roller", "ab wheel", "ab rollout", "wheel rollout", "rollout",
    )
    if (bodyweightRepsOverrides.any { it.matchesLogTypeSignal(paddedHaystack) }) {
        return ExerciseLogType.BODYWEIGHT_REPS
    }

    val timeSignals = listOf(
        "run", "running", "jog", "sprint", "walk", "bike", "cycling", "rower", "rowing",
        "erg", "swim", "plank", "hold", "carry", "stretch", "cardio", "time",
        "min", "mins", "minute", "minutes", "sec", "secs", "second", "seconds",
        "běh", "chůze", "kolo", "plank", "výdrž", "protažení",
    )
    if (timeSignals.any { it.matchesLogTypeSignal(paddedHaystack) }) return ExerciseLogType.TIME

    val weightedEquipment = listOf(
        "barbell", "barbells", "dumbbell", "dumbbells", "kettlebell", "kettlebells",
        "machine", "machines", "cable", "cables", "smith", "plate", "plates",
        "ez bar", "trap bar", "medicine ball", "medicine balls", "činka", "činky", "kladka", "stroj",
    )
    if (weightedEquipment.any { it.matchesLogTypeSignal(paddedHaystack) }) return ExerciseLogType.WEIGHT_REPS

    val bodyweightSignals = listOf(
        "push up", "push ups", "pushup", "pushups",
        "pull up", "pull ups", "pullup", "pullups",
        "chin up", "chin ups", "chinup", "chinups",
        "dip", "dips", "burpee", "burpees",
        "crunch", "crunches", "sit up", "sit ups", "squat jump", "lunge jump", "mountain climber",
        "bodyweight", "calisthenics", "no equipment", "none", "vlastní váha", "bez vybavení",
        "klik", "shyb", "dip",
    )
    if (bodyweightSignals.any { it.matchesLogTypeSignal(paddedHaystack) }) return ExerciseLogType.BODYWEIGHT_REPS

    return ExerciseLogType.WEIGHT_REPS
}

private fun String.matchesLogTypeSignal(paddedHaystack: String): Boolean {
    val signal = normalizedForLogTypeSearch()
    return signal.isNotEmpty() && " $signal " in paddedHaystack
}

private fun String.normalizedForLogTypeSearch(): String = buildString {
    var lastWasSpace = true
    lowercase().forEach { char ->
        if (char.isLetterOrDigit()) {
            append(char)
            lastWasSpace = false
        } else if (!lastWasSpace) {
            append(' ')
            lastWasSpace = true
        }
    }
}.trim()
