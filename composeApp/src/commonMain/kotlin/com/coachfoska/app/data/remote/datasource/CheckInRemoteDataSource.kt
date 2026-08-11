package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.CheckInDto
import com.coachfoska.app.data.remote.dto.CheckInUpsertDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.storage.storage
import io.ktor.http.ContentType
import kotlin.time.Duration.Companion.hours

class CheckInRemoteDataSource(private val supabase: SupabaseClient) {

    companion object {
        private const val TABLE = "check_ins"
        private const val BUCKET = "check-in-photos"
    }

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

    /** Uploads bytes to {userId}/checkin_{weekOf}_{slot}.jpg and returns the object PATH. */
    suspend fun uploadPhoto(userId: String, weekOf: String, slot: String, bytes: ByteArray): String {
        val path = "$userId/checkin_${weekOf}_$slot.jpg"
        supabase.storage.from(BUCKET).upload(path, bytes) {
            upsert = true
            contentType = ContentType.Image.JPEG
        }
        return path
    }

    suspend fun removePhotos(paths: List<String>) {
        if (paths.isNotEmpty()) supabase.storage.from(BUCKET).delete(paths)
    }

    suspend fun signedPhotoUrl(path: String): String =
        supabase.storage.from(BUCKET).createSignedUrl(path, 1.hours)
}
