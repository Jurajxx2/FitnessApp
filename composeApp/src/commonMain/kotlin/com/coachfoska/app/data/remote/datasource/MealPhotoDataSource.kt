package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.BuildKonfig
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.data.remote.dto.MealPhotoAnalysisDto
import com.coachfoska.app.core.logging.AppLogger as Napier
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.storage.storage
import io.ktor.client.HttpClient
import io.ktor.client.request.headers
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.time.Duration.Companion.hours
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private const val TAG = "MealPhotoDataSource"
private const val BUCKET = "meal-photos"

class MealPhotoDataSource(
    private val httpClient: HttpClient,
    private val supabase: SupabaseClient
) {
    private val analyzeUrl = "${BuildKonfig.SUPABASE_URL}/functions/v1/analyze-meal-photo"
    private val json = Json { ignoreUnknownKeys = true }

    @OptIn(ExperimentalEncodingApi::class)
    suspend fun analyzeMealPhoto(imageBytes: ByteArray, mimeType: String = "image/jpeg"): MealPhotoAnalysisDto {
        val accessToken = supabase.auth.currentAccessTokenOrNull()
            ?: throw IllegalStateException("Meal analysis requires an authenticated session")

        val body = json.encodeToString(
            AnalyzeRequest.serializer(),
            AnalyzeRequest(imageBase64 = Base64.encode(imageBytes), mimeType = mimeType)
        )

        val response = httpClient.post(analyzeUrl) {
            headers {
                append(HttpHeaders.Authorization, "Bearer $accessToken")
                append("apikey", BuildKonfig.SUPABASE_ANON_KEY)
            }
            contentType(ContentType.Application.Json)
            setBody(body)
        }

        val text = response.bodyAsText()
        if (!response.status.isSuccess()) {
            Napier.e("analyze-meal-photo failed with status ${response.status}", tag = TAG)
            throw IllegalStateException("Meal analysis failed (${response.status})")
        }
        return json.decodeFromString(MealPhotoAnalysisDto.serializer(), text)
    }

    /** Uploads bytes to {userId}/meal_{millis}.jpg and returns the object PATH (bucket is private). */
    suspend fun uploadMealPhoto(userId: String, imageBytes: ByteArray): String {
        val fileName = "$userId/meal_${currentInstant().toEpochMilliseconds()}.jpg"
        supabase.storage.from(BUCKET).upload(fileName, imageBytes) { upsert = true }
        Napier.d("Meal photo uploaded", tag = TAG)
        return fileName
    }

    suspend fun signedMealPhotoUrl(path: String): String =
        supabase.storage.from(BUCKET).createSignedUrl(path, 1.hours)
}

@Serializable
private data class AnalyzeRequest(
    @SerialName("image_base64") val imageBase64: String,
    @SerialName("mime_type") val mimeType: String
)
