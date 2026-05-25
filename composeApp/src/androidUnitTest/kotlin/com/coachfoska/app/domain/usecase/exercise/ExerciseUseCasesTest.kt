package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.domain.usecase.exercise.GetFavoriteExerciseIdsUseCase
import com.coachfoska.app.domain.usecase.exercise.ToggleFavoriteExerciseUseCase
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

class GetExercisesUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = GetExercisesUseCase(repo)

    @Test
    fun `delegates to repo with correct parameters`() = runTest {
        val exercises = listOf(anExercise())
        coEvery { repo.getExercises(0, 25, 1, "bench", "Beginner", false) } returns Result.success(exercises)

        val result = useCase(offset = 0, categoryId = 1, query = "bench", difficulty = "Beginner")

        assertTrue(result.isSuccess)
        assertEquals(exercises, result.getOrNull())
        coVerify { repo.getExercises(0, 25, 1, "bench", "Beginner", false) }
    }

    @Test
    fun `delegates with default parameters`() = runTest {
        coEvery { repo.getExercises(0, 25, null, null, null, false) } returns Result.success(emptyList())

        val result = useCase(offset = 0)

        assertTrue(result.isSuccess)
        coVerify { repo.getExercises(0, 25, null, null, null, false) }
    }

    @Test
    fun `propagates repo failure`() = runTest {
        coEvery { repo.getExercises(any(), any(), any(), any(), any(), any()) } returns Result.failure(RuntimeException("error"))

        val result = useCase(offset = 0)

        assertTrue(result.isFailure)
    }
}

class GetFavoriteExerciseIdsUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = GetFavoriteExerciseIdsUseCase(repo)

    @Test
    fun `returns set of favorite ids from repo`() = runTest {
        coEvery { repo.getFavoriteIds("user-1") } returns Result.success(setOf("ex-1", "ex-2"))

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(setOf("ex-1", "ex-2"), result.getOrNull())
    }

    @Test
    fun `propagates repo failure`() = runTest {
        coEvery { repo.getFavoriteIds(any()) } returns Result.failure(RuntimeException("error"))

        val result = useCase("user-1")

        assertTrue(result.isFailure)
    }
}

class ToggleFavoriteExerciseUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = ToggleFavoriteExerciseUseCase(repo)

    @Test
    fun `calls setFavorite with isFavorite=true`() = runTest {
        coEvery { repo.setFavorite("user-1", "ex-1", true) } returns Result.success(Unit)

        val result = useCase("user-1", "ex-1", true)

        assertTrue(result.isSuccess)
        coVerify { repo.setFavorite("user-1", "ex-1", true) }
    }

    @Test
    fun `calls setFavorite with isFavorite=false`() = runTest {
        coEvery { repo.setFavorite("user-1", "ex-1", false) } returns Result.success(Unit)

        val result = useCase("user-1", "ex-1", false)

        assertTrue(result.isSuccess)
        coVerify { repo.setFavorite("user-1", "ex-1", false) }
    }
}

private fun anExercise(id: String = "uuid-1") = Exercise(
    id = id, name = "Bench Press", description = "", category = null,
    muscles = emptyList(), musclesSecondary = emptyList(), equipment = emptyList(),
    imageUrl = null, imageUrl2 = null, videoUrl = null, difficulty = null
)
