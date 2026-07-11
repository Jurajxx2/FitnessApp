package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.ExerciseSupabaseDataSource
import com.coachfoska.app.data.remote.dto.ExerciseCategoryDto
import com.coachfoska.app.data.remote.dto.ExerciseDto
import com.coachfoska.app.data.remote.dto.ExerciseLottieAnimationDto
import com.coachfoska.app.domain.model.ExerciseLottieVariant
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
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
    fun `database Lottie payloads map to exercise animations`() {
        val dto = ExerciseDto(
            id = "uuid-1",
            nameEn = "Ab Roller",
            descriptionEn = "Description",
            lottieAnimations = listOf(
                ExerciseLottieAnimationDto(
                    figureVariant = "woman",
                    lottieJson = Json.parseToJsonElement("{\"nm\":\"Ab Roller (woman)\"}"),
                    storageUrl = "https://example.com/ab-roller-woman.json",
                ),
            ),
        )

        val animation = dto.toDomain().lottieAnimations.single()

        assertEquals(ExerciseLottieVariant.WOMAN, animation.variant)
        assertEquals("{\"nm\":\"Ab Roller (woman)\"}", animation.lottieJson)
        assertEquals("https://example.com/ab-roller-woman.json", animation.storageUrl)
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

    @Test
    fun `getExercises maps DTOs to domain models`() = runTest {
        val dto = anExerciseDto(id = "uuid-1", nameEn = "Bench Press")
        coEvery { dataSource.getExercises(0, 25, null, null, null, false, null) } returns listOf(dto)

        val result = repository.getExercises(offset = 0, limit = 25)

        assertTrue(result.isSuccess)
        val exercises = result.getOrThrow()
        assertEquals(1, exercises.size)
        assertEquals("uuid-1", exercises[0].id)
        assertEquals("Bench Press", exercises[0].name)
    }

    @Test
    fun `getExercises propagates exception`() = runTest {
        coEvery { dataSource.getExercises(any(), any(), any(), any(), any(), any(), any()) } throws RuntimeException("DB error")

        val result = repository.getExercises(offset = 0, limit = 25)

        assertTrue(result.isFailure)
        assertEquals("DB error", result.exceptionOrNull()?.message)
    }

    @Test
    fun `getExercisesByCategory maps muscles and equipment`() = runTest {
        val dto = anExerciseDto(
            primaryMuscles = listOf("chest", "triceps"),
            secondaryMuscles = listOf("anterior deltoid"),
            equipmentNames = listOf("barbell")
        )
        coEvery { dataSource.getExercisesByCategory(1) } returns listOf(dto)

        val result = repository.getExercisesByCategory(1)

        assertTrue(result.isSuccess)
        val exercise = result.getOrThrow().first()
        assertEquals(listOf("chest", "triceps"), exercise.muscles)
        assertEquals(listOf("anterior deltoid"), exercise.musclesSecondary)
        assertEquals(listOf("barbell"), exercise.equipment)
    }

    @Test
    fun `getExercises with ids forwards ids to datasource`() = runTest {
        val ids = listOf("ex-1", "ex-2")
        coEvery { dataSource.getExercises(0, 25, null, null, null, false, ids) } returns listOf(anExerciseDto())

        val result = repository.getExercises(offset = 0, limit = 25, ids = ids)

        assertTrue(result.isSuccess)
        coVerify { dataSource.getExercises(0, 25, null, null, null, false, ids) }
    }

    @Test
    fun `getFavoriteIds returns set of ids from datasource`() = runTest {
        coEvery { dataSource.getFavoriteIds("user-1") } returns listOf("ex-1", "ex-2")

        val result = repository.getFavoriteIds("user-1")

        assertTrue(result.isSuccess)
        assertEquals(setOf("ex-1", "ex-2"), result.getOrNull())
    }

    @Test
    fun `getFavoriteIds deduplicates via toSet`() = runTest {
        coEvery { dataSource.getFavoriteIds("user-1") } returns listOf("ex-1", "ex-1")

        val result = repository.getFavoriteIds("user-1")

        assertTrue(result.isSuccess)
        assertEquals(setOf("ex-1"), result.getOrNull())
    }

    @Test
    fun `getFavoriteIds propagates exception`() = runTest {
        coEvery { dataSource.getFavoriteIds(any()) } throws RuntimeException("network error")

        val result = repository.getFavoriteIds("user-1")

        assertTrue(result.isFailure)
    }

    @Test
    fun `setFavorite true calls addFavorite`() = runTest {
        coEvery { dataSource.addFavorite("user-1", "ex-1") } returns Unit

        val result = repository.setFavorite("user-1", "ex-1", true)

        assertTrue(result.isSuccess)
        coVerify { dataSource.addFavorite("user-1", "ex-1") }
        coVerify(exactly = 0) { dataSource.removeFavorite(any(), any()) }
    }

    @Test
    fun `setFavorite false calls removeFavorite`() = runTest {
        coEvery { dataSource.removeFavorite("user-1", "ex-1") } returns Unit

        val result = repository.setFavorite("user-1", "ex-1", false)

        assertTrue(result.isSuccess)
        coVerify { dataSource.removeFavorite("user-1", "ex-1") }
        coVerify(exactly = 0) { dataSource.addFavorite(any(), any()) }
    }

    @Test
    fun `setFavorite propagates exception`() = runTest {
        coEvery { dataSource.addFavorite(any(), any()) } throws RuntimeException("insert error")

        val result = repository.setFavorite("user-1", "ex-1", true)

        assertTrue(result.isFailure)
    }
}

private fun anExerciseDto(
    id: String = "uuid-1",
    nameEn: String = "Exercise",
    primaryMuscles: List<String> = emptyList(),
    secondaryMuscles: List<String> = emptyList(),
    equipmentNames: List<String> = emptyList()
) = ExerciseDto(
    id = id,
    nameEn = nameEn,
    descriptionEn = "Description",
    primaryMuscles = primaryMuscles,
    secondaryMuscles = secondaryMuscles,
    equipmentNames = equipmentNames
)
