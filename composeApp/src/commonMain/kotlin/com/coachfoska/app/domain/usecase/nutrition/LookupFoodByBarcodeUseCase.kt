package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.data.remote.datasource.OpenFoodFactsDataSource
import com.coachfoska.app.data.remote.dto.toFood
import com.coachfoska.app.domain.model.Food

/**
 * Success with null means Open Food Facts did not return a usable product for this barcode.
 */
class LookupFoodByBarcodeUseCase(private val dataSource: OpenFoodFactsDataSource) {
    suspend operator fun invoke(barcode: String): Result<Food?> =
        runCatching { dataSource.lookup(barcode).toFood() }
}
