package com.coachfoska.app.fixtures

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
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
    id: String = "workout-1",
    name: String = "Push Day",
    dayOfWeek: DayOfWeek? = DayOfWeek.MONDAY
) = Workout(
    id = id,
    name = name,
    dayOfWeek = dayOfWeek,
    durationMinutes = 60,
    exercises = emptyList()
)

fun aWorkoutLog(
    id: String = "log-1",
    userId: String = "user-1"
) = WorkoutLog(
    id = id,
    userId = userId,
    workoutId = "workout-1",
    workoutName = "Push Day",
    durationMinutes = 60,
    notes = null,
    exerciseLogs = emptyList(),
    loggedAt = Instant.parse("2026-04-06T10:00:00Z")
)

fun anExerciseLog(id: String = "ex-log-1", workoutLogId: String = "log-1") = ExerciseLog(
    id = id,
    workoutLogId = workoutLogId,
    exerciseName = "Bench Press",
    setsCompleted = 3,
    repsCompleted = "10",
    weightKg = 80f,
    notes = null
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
    name: String = "Overnight Oats"
) = Recipe(
    id = id,
    name = name,
    description = "Easy breakfast",
    calories = 386f,
    protein = 16f,
    carbs = 65f,
    fat = 9f
)

fun aChatMessage(id: String = "msg-1") = ChatMessage(
    id = id,
    userId = "user-1",
    chatType = ChatType.Human,
    senderType = SenderType.Coach,
    content = MessageContent.Text("Great workout today!"),
    createdAt = Instant.parse("2026-04-06T09:00:00Z")
)
