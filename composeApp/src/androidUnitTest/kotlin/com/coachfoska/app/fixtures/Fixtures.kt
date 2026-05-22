package com.coachfoska.app.fixtures

import com.coachfoska.app.data.remote.dto.*
import com.coachfoska.app.domain.model.*
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate

fun aUser(
    id: String = "user-1",
    email: String = "test@example.com",
    onboardingComplete: Boolean = true
) = User(
    id = id,
    email = email,
    fullName = "Test User",
    age = 30,
    heightCm = 175f,
    weightKg = 75f,
    goal = UserGoal.MUSCLE_GAIN,
    activityLevel = ActivityLevel.MODERATELY_ACTIVE,
    onboardingComplete = onboardingComplete
)

fun aWorkout(
    id: String = "w-1",
    name: String = "Push Day",
    exercises: List<WorkoutExercise> = emptyList()
) = Workout(
    id = id,
    name = name,
    dayOfWeek = DayOfWeek.MONDAY,
    durationMinutes = 60,
    exercises = exercises
)

fun aWorkoutLog(
    id: String = "log-1",
    userId: String = "user-1",
    workoutName: String = "Push Day",
    exerciseLogs: List<ExerciseLog> = emptyList()
) = WorkoutLog(
    id = id,
    userId = userId,
    workoutId = "w-1",
    workoutName = workoutName,
    durationMinutes = 60,
    notes = null,
    exerciseLogs = exerciseLogs,
    loggedAt = Instant.parse("2026-04-03T10:00:00Z")
)

fun aSetLog(
    id: String = "set-1",
    exerciseLogId: String = "ex-log-1",
    sortOrder: Int = 1,
    targetReps: Int? = 10,
    actualReps: Int? = 10,
    targetWeightKg: Float? = 80f,
    actualWeightKg: Float? = 80f,
    rpe: Int? = 7,
    targetRestSeconds: Int? = 90,
    actualRestSeconds: Int? = null,
    completed: Boolean = true,
) = SetLog(
    id = id, exerciseLogId = exerciseLogId, sortOrder = sortOrder,
    targetReps = targetReps, actualReps = actualReps,
    targetWeightKg = targetWeightKg, actualWeightKg = actualWeightKg,
    rpe = rpe,
    targetRestSeconds = targetRestSeconds, actualRestSeconds = actualRestSeconds,
    completed = completed,
)

fun anExerciseLog(
    id: String = "ex-log-1",
    workoutLogId: String = "log-1",
    sets: List<SetLog> = emptyList(),
) = ExerciseLog(
    id = id,
    workoutLogId = workoutLogId,
    exerciseName = "Bench Press",
    notes = null,
    sets = sets,
)

fun aMealPlan(
    id: String = "plan-1",
    name: String = "Bulk Plan"
) = MealPlan(id = id, name = name, description = null, meals = emptyList(), validFrom = null, validTo = null)

fun aMealLog(
    id: String = "meal-log-1",
    userId: String = "user-1"
) = MealLog(
    id = id,
    userId = userId,
    mealName = "Breakfast",
    notes = null,
    foods = emptyList(),
    loggedAt = Instant.parse("2026-04-06T08:00:00Z")
)

fun aWeightEntry(
    id: String = "weight-1",
    userId: String = "user-1",
    weightKg: Float = 75f
) = WeightEntry(
    id = id,
    userId = userId,
    weightKg = weightKg,
    recordedAt = LocalDate.parse("2026-04-06")
)

fun aNutritionSummary() = DailyNutritionSummary(
    calories = 2000f,
    proteinG = 150f,
    carbsG = 200f,
    fatG = 80f
)

fun aRecipe(
    id: String = "r-1",
    name: String = "Overnight Oats",
    ingredients: List<RecipeIngredient> = emptyList(),
    steps: List<RecipeStep> = emptyList()
) = Recipe(
    id = id,
    name = name,
    description = "Easy breakfast",
    calories = 386f,
    protein = 16f,
    carbs = 65f,
    fat = 9f,
    ingredients = ingredients,
    steps = steps
)

fun aRecipeStep(
    id: String = "s-1",
    stepNumber: Int = 1,
    instruction: String = "Mix ingredients in a bowl"
) = RecipeStep(
    id = id,
    stepNumber = stepNumber,
    instruction = instruction
)

fun aChatMessage(id: String = "msg-1") = ChatMessage(
    id = id,
    userId = "user-1",
    chatType = ChatType.Human,
    senderType = SenderType.Coach,
    content = MessageContent.Text("Great workout today!"),
    createdAt = Instant.parse("2026-04-06T09:00:00Z")
)

fun aChatMessageDto(
    id: String = "msg-1",
    userId: String = "user-1",
    chatType: String = "human",
    senderType: String = "coach",
    textContent: String = "Great workout today!",
    createdAt: String = "2026-04-23T10:00:00Z"
) = ChatMessageDto(
    id = id,
    userId = userId,
    chatType = chatType,
    senderType = senderType,
    contentType = "text",
    textContent = textContent,
    imageUrl = null,
    createdAt = createdAt,
    readAt = null
)

fun aGeneralActivityLog(
    id: String = "act-1",
    userId: String = "user-1",
    type: ActivityType = ActivityType.RUNNING,
    durationMinutes: Int = 30,
    distanceKm: Double? = 5.0,
    rpe: Int? = 7,
) = GeneralActivityLog(
    id = id, userId = userId, type = type,
    durationMinutes = durationMinutes, distanceKm = distanceKm, rpe = rpe,
    loggedAt = Instant.parse("2026-05-21T10:00:00Z"),
    notes = null,
)

fun aGeneralActivityLogDto(
    id: String = "act-1",
    activityType: String = "RUNNING",
) = GeneralActivityLogDto(
    id = id, userId = "user-1", activityType = activityType,
    durationMinutes = 30, distanceKm = 5.0, rpe = 7,
    loggedAt = "2026-05-21T10:00:00Z", notes = null,
)

fun aWorkoutDto(id: String = "w-1") = WorkoutDto(
    id = id,
    name = "Push Day",
    dayOfWeek = 0,
    durationMinutes = 60,
    exercises = emptyList()
)

fun aWorkoutLogDto(id: String = "log-1") = WorkoutLogDto(
    id = id,
    userId = "user-1",
    workoutName = "Push Day",
    durationMinutes = 60,
    loggedAt = "2026-04-03T10:00:00Z"
)
