package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.ExerciseSupabaseDataSource
import com.coachfoska.app.data.remote.dto.ExerciseCategoryDto
import com.coachfoska.app.data.remote.dto.ExerciseDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ExerciseRepositoryImplTest {

    private val dataSource: ExerciseSupabaseDataSource = mockk()
    private val repository = ExerciseRepositoryImpl(dataSource)

    @Test
    fun `getCategories maps DTOs to domain models`() = runTest {
        coEvery { dataSource.getCategories() } returns listOf(
            ExerciseCategoryDto(id = 1, name = "Chest"),
            ExerciseCategoryDto(id = 2, name = "Back")
        )

        val result = repository.getCategories()

        assertTrue(result.isSuccess)
        val cats = result.getOrThrow()
        assertEquals(2, cats.size)
        assertEquals(1, cats[0].id)
        assertEquals("Chest", cats[0].name)
    }

    @Test
    fun `getCategories propagates exception`() = runTest {
        coEvery { dataSource.getCategories() } throws RuntimeException("DB error")

        val result = repository.getCategories()

        assertTrue(result.isFailure)
        assertEquals("DB error", result.exceptionOrNull()?.message)
    }

    @Test
    fun `getExercisesByCategory maps DTOs`() = runTest {
        val dto = anExerciseDto(id = "uuid-1", nameEn = "Bench Press")
        coEvery { dataSource.getExercisesByCategory(1) } returns listOf(dto)

        val result = repository.getExercisesByCategory(1)

        assertTrue(result.isSuccess)
        val exercises = result.getOrThrow()
        assertEquals(1, exercises.size)
        assertEquals("uuid-1", exercises[0].id)
        assertEquals("Bench Press", exercises[0].name)
    }

    @Test
    fun `getExerciseById maps single DTO`() = runTest {
        val dto = anExerciseDto(id = "uuid-1", nameEn = "Squat")
        coEvery { dataSource.getExerciseById("uuid-1") } returns dto

        val result = repository.getExerciseById("uuid-1")

        assertTrue(result.isSuccess)
        assertEquals("uuid-1", result.getOrThrow().id)
        assertEquals("Squat", result.getOrThrow().name)
    }

    @Test
    fun `searchExercises maps results`() = runTest {
        coEvery { dataSource.searchExercises("press") } returns listOf(anExerciseDto(nameEn = "Bench Press"))

        val result = repository.searchExercises("press")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
    }

    @Test
    fun `searchExercises blank query returns empty without calling datasource`() = runTest {
        val result = repository.searchExercises("  ")

        assertTrue(result.isSuccess)
        assertEquals(emptyList(), result.getOrThrow())
        coVerify(exactly = 0) { dataSource.searchExercises(any()) }
    }
}

private fun anExerciseDto(
    id: String = "uuid-1",
    nameEn: String = "Exercise"
) = ExerciseDto(
    id = id,
    nameEn = nameEn,
    descriptionEn = "Description"
)
