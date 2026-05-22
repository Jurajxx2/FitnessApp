package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.HydrationRemoteDataSource
import com.coachfoska.app.data.remote.dto.WaterContainerDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class HydrationRepositoryContainersTest {
    private val ds: HydrationRemoteDataSource = mockk()
    private val repo = HydrationRepositoryImpl(ds)

    private val dto = WaterContainerDto(
        id = "c1", userId = "u1", name = "Gym Bottle",
        volumeMl = 750, iconName = "bottle", isFavorite = false,
    )

    @Test
    fun `getContainers maps DTOs to domain`() = runTest {
        coEvery { ds.listContainers("u1") } returns listOf(dto)
        val result = repo.getContainers("u1")
        assertTrue(result.isSuccess)
        assertEquals("Gym Bottle", result.getOrNull()?.single()?.name)
        assertEquals(750, result.getOrNull()?.single()?.volumeMl)
    }

    @Test
    fun `addContainer delegates and returns mapped domain`() = runTest {
        coEvery { ds.insertContainer("u1", "Cup", 250, "bottle") } returns dto.copy(name = "Cup", volumeMl = 250)
        val result = repo.addContainer("u1", "Cup", 250, "bottle")
        assertTrue(result.isSuccess)
        assertEquals("Cup", result.getOrNull()?.name)
    }

    @Test
    fun `deleteContainer delegates`() = runTest {
        coEvery { ds.deleteContainer("c1") } returns Unit
        val result = repo.deleteContainer("c1")
        assertTrue(result.isSuccess)
        coVerify { ds.deleteContainer("c1") }
    }

    @Test
    fun `toggleFavorite delegates and returns mapped domain`() = runTest {
        coEvery { ds.setContainerFavorite("c1", true) } returns dto.copy(isFavorite = true)
        val result = repo.toggleFavoriteContainer("c1", true)
        assertTrue(result.isSuccess)
        assertEquals(true, result.getOrNull()?.isFavorite)
    }
}
