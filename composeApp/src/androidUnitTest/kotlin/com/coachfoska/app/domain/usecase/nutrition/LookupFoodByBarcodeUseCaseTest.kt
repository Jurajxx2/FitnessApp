package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.data.remote.datasource.OpenFoodFactsDataSource
import com.coachfoska.app.data.remote.dto.OpenFoodFactsNutriments
import com.coachfoska.app.data.remote.dto.OpenFoodFactsProduct
import com.coachfoska.app.data.remote.dto.OpenFoodFactsResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LookupFoodByBarcodeUseCaseTest {

    private val dataSource: OpenFoodFactsDataSource = mockk()
    private val useCase = LookupFoodByBarcodeUseCase(dataSource)

    @Test
    fun `returns mapped Food on a found product`() = runTest {
        coEvery { dataSource.lookup("123") } returns OpenFoodFactsResponse(
            status = 1,
            code = "123",
            product = OpenFoodFactsProduct(
                productName = "Milk",
                brands = "Farm",
                servingSize = "250 ml",
                nutriments = OpenFoodFactsNutriments(
                    energyKcal100g = 42f,
                    proteins100g = 3.4f,
                    carbohydrates100g = 5f,
                    fat100g = 1f,
                )
            )
        )

        val food = useCase("123").getOrNull()

        assertEquals("Milk", food?.name)
        assertEquals(42f, food?.calories)
    }

    @Test
    fun `returns success-null when product not found`() = runTest {
        coEvery { dataSource.lookup("000") } returns OpenFoodFactsResponse(
            status = 0,
            code = "000",
            product = null,
        )

        val result = useCase("000")

        assertTrue(result.isSuccess)
        assertNull(result.getOrNull())
    }

    @Test
    fun `returns failure on network error`() = runTest {
        coEvery { dataSource.lookup(any()) } throws RuntimeException("offline")

        val result = useCase("123")

        assertTrue(result.isFailure)
    }
}
