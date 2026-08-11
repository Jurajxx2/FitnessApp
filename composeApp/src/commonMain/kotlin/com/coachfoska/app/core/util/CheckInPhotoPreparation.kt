package com.coachfoska.app.core.util

const val CHECK_IN_TIME_ZONE_ID = "Europe/Prague"
const val MAX_CHECK_IN_PHOTO_BYTES = 5 * 1024 * 1024
const val MAX_CHECK_IN_PHOTO_DIMENSION = 2_000

data class ImageDimensions(val width: Int, val height: Int)

fun fitCheckInPhotoDimensions(
    width: Int,
    height: Int,
    maxDimension: Int = MAX_CHECK_IN_PHOTO_DIMENSION,
): ImageDimensions {
    require(width > 0 && height > 0 && maxDimension > 0) { "Image dimensions must be positive" }
    val scale = minOf(1.0, maxDimension.toDouble() / maxOf(width, height))
    return ImageDimensions(
        width = maxOf(1, (width * scale).toInt()),
        height = maxOf(1, (height * scale).toInt()),
    )
}

/** Power-of-two sampling keeps legacy Android decodes below twice the target edge. */
fun calculateCheckInDecodeSampleSize(
    width: Int,
    height: Int,
    maxDimension: Int = MAX_CHECK_IN_PHOTO_DIMENSION,
): Int {
    val target = fitCheckInPhotoDimensions(width, height, maxDimension)
    var sampleSize = 1
    while (
        sampleSize <= Int.MAX_VALUE / 2 &&
        width / (sampleSize * 2) >= target.width &&
        height / (sampleSize * 2) >= target.height
    ) {
        sampleSize *= 2
    }
    return sampleSize
}
