package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.OpenFoodFactsResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.http.HttpHeaders

/**
 * Looks up a product by barcode from the Open Food Facts v2 API.
 */
class OpenFoodFactsDataSource(private val httpClient: HttpClient) {

    suspend fun lookup(barcode: String): OpenFoodFactsResponse =
        httpClient.get("https://world.openfoodfacts.org/api/v2/product/$barcode.json") {
            parameter("fields", "code,product_name,brands,serving_size,nutriments")
            header(HttpHeaders.UserAgent, "CoachFoska/1.0 (Android)")
        }.body()
}
