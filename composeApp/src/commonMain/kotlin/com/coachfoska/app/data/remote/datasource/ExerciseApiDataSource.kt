package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.WgerExerciseInfoDto
import com.coachfoska.app.data.remote.dto.WgerListResponse
import com.coachfoska.app.data.remote.dto.WgerExerciseSearchDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter

private const val WGER_BASE_URL = "https://wger.de/api/v2"
private const val ENGLISH_LANGUAGE_ID = 2

class ExerciseApiDataSource(private val httpClient: HttpClient) {

    suspend fun searchExercises(query: String): List<WgerExerciseInfoDto> {
        // Search translations for English exercises matching the query
        val translationResponse = httpClient.get("$WGER_BASE_URL/exercisesearch/") {
            parameter("term", query)
            parameter("language", "english")
            parameter("format", "json")
        }
        // WGER search returns suggestions list; fetch full info for each match
        val results = translationResponse.body<WgerSearchResponse>()
        return results.suggestions.take(20).mapNotNull { suggestion ->
            runCatching { getExerciseById(suggestion.data.id) }.getOrNull()
        }
    }

    suspend fun getExerciseById(id: Int): WgerExerciseInfoDto =
        httpClient.get("$WGER_BASE_URL/exerciseinfo/$id/") {
            parameter("format", "json")
        }.body()

    suspend fun getExercisesByCategory(categoryId: Int): List<WgerExerciseInfoDto> {
        val response = httpClient.get("$WGER_BASE_URL/exercise/") {
            parameter("format", "json")
            parameter("language", ENGLISH_LANGUAGE_ID)
            parameter("category", categoryId)
            parameter("limit", 50)
        }
        val list = response.body<WgerListResponse<WgerExerciseSearchDto>>()
        return list.results.mapNotNull { item ->
            runCatching { getExerciseById(item.id) }.getOrNull()
        }
    }
}

@kotlinx.serialization.Serializable
private data class WgerSearchResponse(
    val suggestions: List<WgerSuggestion>
)

@kotlinx.serialization.Serializable
private data class WgerSuggestion(
    val value: String,
    val data: WgerSuggestionData
)

@kotlinx.serialization.Serializable
private data class WgerSuggestionData(
    val id: Int,
    val name: String = "",
    val category: String = "",
    @kotlinx.serialization.SerialName("image") val imageUrl: String? = null,
    @kotlinx.serialization.SerialName("image_thumbnail") val imageThumbnailUrl: String? = null
)
