package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.core.logging.AppLogger as Napier
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.storage.storage

private const val TAG = "ChatStorageDataSource"
private const val BUCKET = "chat-images"

class ChatStorageDataSource(private val supabase: SupabaseClient) {

    /**
     * Uploads [imageBytes] to the [BUCKET] Supabase Storage bucket.
     * @return The public URL of the uploaded file.
     */
    suspend fun uploadImage(userId: String, imageBytes: ByteArray): Result<String> = runCatching {
        val fileName = "${userId}/${generateId()}.jpg"
        val bucket = supabase.storage.from(BUCKET)
        bucket.upload(fileName, imageBytes) {
            upsert = true
        }
        val publicUrl = bucket.publicUrl(fileName)
        Napier.d("Chat image uploaded", tag = TAG)
        publicUrl
    }

    private fun generateId(): String {
        // Simple timestamp-based ID since UUID isn't directly available in commonMain
        return "img_${currentInstant().toEpochMilliseconds()}"
    }
}
