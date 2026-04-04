package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.core.util.currentInstant
import io.github.aakira.napier.Napier
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.storage.storage
import io.github.jan.supabase.storage.upload

private const val TAG = "ChatStorageDataSource"
private const val BUCKET = "chat-images"

class ChatStorageDataSource(private val supabase: SupabaseClient) {

    /**
     * Uploads [imageBytes] to the [BUCKET] Supabase Storage bucket.
     * @return The public URL of the uploaded file.
     */
    suspend fun uploadImage(userId: String, imageBytes: ByteArray): Result<String> = runCatching {
        val fileName = "${userId}/${generateId()}.jpg"
        supabase.storage[BUCKET].upload(fileName, imageBytes)
        val publicUrl = supabase.storage[BUCKET].publicUrl(fileName)
        Napier.d("Uploaded chat image: $publicUrl", tag = TAG)
        publicUrl
    }

    private fun generateId(): String {
        // Simple timestamp-based ID since UUID isn't directly available in commonMain
        return "img_${currentInstant().toEpochMilliseconds()}"
    }
}
