package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GetExerciseByIdUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = GetExerciseByIdUseCase(repo)

    @Test
    fun `delegates to repo with string id`() = runTest {
        val exercise = anExercise(id = "uuid-abc")
        coEvery { repo.getExerciseById("uuid-abc") } returns Result.success(exercise)

        val result = useCase("uuid-abc")

        assertTrue(result.isSuccess)
        assertEquals(exercise, result.getOrNull())
        coVerify { repo.getExerciseById("uuid-abc") }
    }

    @Test
    fun `propagates repo failure`() = runTest {
        coEvery { repo.getExerciseById(any()) } returns Result.failure(RuntimeException("not found"))

        val result = useCase("uuid-abc")

        assertTrue(result.isFailure)
    }
}

class GetExercisesByCategoryUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = GetExercisesByCategoryUseCase(repo)

    @Test
    fun `delegates to repo with category id`() = runTest {
        val exercises = listOf(anExercise(), anExercise(id = "uuid-2"))
        coEvery { repo.getExercisesByCategory(3) } returns Result.success(exercises)

        val result = useCase(3)

        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrThrow().size)
        coVerify { repo.getExercisesByCategory(3) }
    }
}

class SearchExercisesUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = SearchExercisesUseCase(repo)

    @Test
    fun `blank query returns empty without calling repo`() = runTest {
        val result = useCase("   ")

        assertTrue(result.isSuccess)
        assertEquals(emptyList(), result.getOrNull())
        coVerify(exactly = 0) { repo.searchExercises(any()) }
    }

    @Test
    fun `non-blank query delegates trimmed query to repo`() = runTest {
        coEvery { repo.searchExercises("bench") } returns Result.success(listOf(anExercise()))

        val result = useCase("  bench  ")

        assertTrue(result.isSuccess)
        coVerify { repo.searchExercises("bench") }
    }
}

class GetExerciseCategoriesUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = GetExerciseCategoriesUseCase(repo)

    @Test
    fun `delegates to repo`() = runTest {
        val cats = listOf(ExerciseCategory(1, "Chest"), ExerciseCategory(2, "Back"))
        coEvery { repo.getCategories() } returns Result.success(cats)

        val result = useCase()

        assertTrue(result.isSuccess)
        assertEquals(cats, result.getOrNull())
    }
}

private fun anExercise(id: String = "uuid-1") = Exercise(
    id = id, name = "Bench Press", description = "", category = null,
    muscles = emptyList<String>(), musclesSecondary = emptyList<String>(), equipment = emptyList<String>(),
    imageUrl = null, videoUrl = null, difficulty = null
)
