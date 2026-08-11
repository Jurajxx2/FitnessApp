package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.BuildKonfig
import com.coachfoska.app.core.util.MAX_CHECK_IN_PHOTO_BYTES
import com.coachfoska.app.data.remote.dto.CheckInDto
import com.coachfoska.app.data.remote.dto.CheckInUpsertDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
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
import kotlin.time.Duration.Companion.hours
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class CheckInRemoteDataSource(
    private val httpClient: HttpClient,
    private val supabase: SupabaseClient,
) {

    companion object {
        private const val TABLE = "check_ins"
        private const val BUCKET = "check-in-photos"
    }

    private val uploadUrl = "${BuildKonfig.SUPABASE_URL}/functions/v1/check-in-photo-upload"
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun upsert(dto: CheckInUpsertDto): CheckInDto =
        supabase.postgrest[TABLE]
            .upsert(dto) {
                onConflict = "user_id,week_of"
                select()
            }
            .decodeSingle()

    suspend fun getHistory(userId: String): List<CheckInDto> =
        supabase.postgrest[TABLE]
            .select {
                filter { eq("user_id", userId) }
                order("week_of", Order.DESCENDING)
            }
            .decodeList()

    suspend fun getForWeek(userId: String, weekOf: String): CheckInDto? =
        supabase.postgrest[TABLE]
            .select {
                filter {
                    eq("user_id", userId)
                    eq("week_of", weekOf)
                }
            }
            .decodeList<CheckInDto>()
            .firstOrNull()

    /** Uploads through the authenticated validator; the server derives the object owner from JWT. */
    suspend fun uploadPhoto(weekOf: String, slot: String, bytes: ByteArray): String {
        require(slot == "front" || slot == "side") { "Photo slot must be front or side" }
        require(bytes.isNotEmpty()) { "Photo is empty" }
        require(bytes.size <= MAX_CHECK_IN_PHOTO_BYTES) { "Photo must be no larger than 5 MB" }
        val mimeType = bytes.detectImageContentType()
            ?: throw IllegalArgumentException("Photo must be a JPEG image")
        val accessToken = supabase.auth.currentAccessTokenOrNull()
            ?: throw IllegalStateException("Photo upload requires an authenticated session")

        val response = httpClient.post(uploadUrl) {
            headers {
                append(HttpHeaders.Authorization, "Bearer $accessToken")
                append("apikey", BuildKonfig.SUPABASE_ANON_KEY)
                append("x-check-in-week", weekOf)
                append("x-check-in-slot", slot)
            }
            contentType(mimeType)
            setBody(bytes)
        }

        val responseBody = response.bodyAsText()
        if (!response.status.isSuccess()) {
            val message = when (response.status.value) {
                400 -> "Photo must be a valid current-week JPEG"
                401 -> "Please sign in again before uploading a photo"
                403 -> "Check-in photo access is not available"
                413 -> "Photo must be no larger than 5 MB"
                429 -> "Photo upload limit reached. Please try again later"
                else -> "Photo upload failed (${response.status.value})"
            }
            throw IllegalStateException(message)
        }
        return json.decodeFromString<CheckInPhotoUploadResponse>(responseBody).path
    }

    suspend fun removePhotos(paths: List<String>) {
        if (paths.isNotEmpty()) supabase.storage.from(BUCKET).delete(paths)
    }

    suspend fun signedPhotoUrl(path: String): String =
        supabase.storage.from(BUCKET).createSignedUrl(path, 1.hours)
}

@Serializable
private data class CheckInPhotoUploadResponse(
    val path: String,
    @SerialName("mime_type") val mimeType: String,
)

private fun ByteArray.detectImageContentType(): ContentType? = when {
    size >= 3 && this[0] == 0xFF.toByte() && this[1] == 0xD8.toByte() && this[2] == 0xFF.toByte() ->
        ContentType.Image.JPEG
    else -> null
}
