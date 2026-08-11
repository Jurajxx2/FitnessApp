package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.useContents
import kotlinx.cinterop.usePinned
import platform.CoreGraphics.CGRectMake
import platform.CoreGraphics.CGSizeMake
import platform.Foundation.NSData
import platform.Foundation.NSFileManager
import platform.Foundation.NSUUID
import platform.Foundation.NSURL
import platform.UIKit.UIApplication
import platform.UIKit.UIImage
import platform.UIKit.UIImageJPEGRepresentation
import platform.UIKit.UIImagePickerController
import platform.UIKit.UIImagePickerControllerDelegateProtocol
import platform.UIKit.UIImagePickerControllerMediaURL
import platform.UIKit.UIImagePickerControllerOriginalImage
import platform.UIKit.UIImagePickerControllerSourceType
import platform.UIKit.UINavigationController
import platform.UIKit.UINavigationControllerDelegateProtocol
import platform.UIKit.UITabBarController
import platform.UIKit.UIViewController
import platform.UIKit.UIWindow
import platform.UIKit.UIWindowScene
import platform.UIKit.UIGraphicsBeginImageContextWithOptions
import platform.UIKit.UIGraphicsEndImageContext
import platform.UIKit.UIGraphicsGetImageFromCurrentImageContext
import platform.darwin.NSObject
import platform.posix.memcpy

@OptIn(ExperimentalForeignApi::class)
private fun NSData.toByteArray(): ByteArray {
    val result = ByteArray(length.toInt())
    if (result.isNotEmpty()) {
        result.usePinned { pinned -> memcpy(pinned.addressOf(0), bytes, length) }
    }
    return result
}

@OptIn(ExperimentalForeignApi::class)
private fun resizeImage(image: UIImage, width: Int, height: Int): UIImage? {
    UIGraphicsBeginImageContextWithOptions(CGSizeMake(width.toDouble(), height.toDouble()), true, 1.0)
    image.drawInRect(CGRectMake(0.0, 0.0, width.toDouble(), height.toDouble()))
    val resized = UIGraphicsGetImageFromCurrentImageContext()
    UIGraphicsEndImageContext()
    return resized
}

@OptIn(ExperimentalForeignApi::class)
private fun prepareCheckInPhoto(image: UIImage): ByteArray? {
    val sourceDimensions = image.size.useContents {
        fitCheckInPhotoDimensions(width.toInt(), height.toInt())
    }
    var prepared = image.size.useContents {
        if (width.toInt() == sourceDimensions.width && height.toInt() == sourceDimensions.height) image
        else resizeImage(image, sourceDimensions.width, sourceDimensions.height) ?: return null
    }

    repeat(5) {
        for (quality in listOf(0.86, 0.76, 0.66, 0.56)) {
            val data = UIImageJPEGRepresentation(prepared, quality) ?: continue
            if (data.length.toLong() <= MAX_CHECK_IN_PHOTO_BYTES) return data.toByteArray()
        }
        val next = prepared.size.useContents {
            resizeImage(
                prepared,
                maxOf(1, (width * 0.78).toInt()),
                maxOf(1, (height * 0.78).toInt()),
            )
        } ?: return null
        prepared = next
    }
    return null
}

private fun applicationRootViewController(): UIViewController? {
    val keyWindow = UIApplication.sharedApplication.connectedScenes
        .mapNotNull { it as? UIWindowScene }
        .flatMap { it.windows.filterIsInstance<UIWindow>() }
        .firstOrNull { it.keyWindow }
        ?: UIApplication.sharedApplication.windows.filterIsInstance<UIWindow>().firstOrNull { it.keyWindow }
    return keyWindow?.rootViewController
}

private fun topViewController(root: UIViewController? = applicationRootViewController()): UIViewController? {
    val presented = root?.presentedViewController
    if (presented != null) return topViewController(presented)
    return when (root) {
        is UINavigationController -> topViewController(root.visibleViewController)
        is UITabBarController -> topViewController(root.selectedViewController)
        else -> root
    }
}

private class MediaPickerDelegate(
    private val mode: MediaCaptureMode,
    private val onResult: (String?) -> Unit,
) : NSObject(), UIImagePickerControllerDelegateProtocol, UINavigationControllerDelegateProtocol {

    override fun imagePickerController(
        picker: UIImagePickerController,
        didFinishPickingMediaWithInfo: Map<Any?, *>,
    ) {
        val token = when (mode) {
            MediaCaptureMode.PHOTO -> {
                val image = didFinishPickingMediaWithInfo[UIImagePickerControllerOriginalImage] as? UIImage
                image?.let(::prepareCheckInPhoto)?.let { bytes ->
                    val key = "checkin-photo-${NSUUID.UUID().UUIDString}"
                    preparedMedia[key] = bytes
                    key
                }
            }
            MediaCaptureMode.VIDEO ->
                (didFinishPickingMediaWithInfo[UIImagePickerControllerMediaURL] as? NSURL)?.absoluteString
        }
        picker.dismissViewControllerAnimated(true) { onResult(token) }
    }

    override fun imagePickerControllerDidCancel(picker: UIImagePickerController) {
        picker.dismissViewControllerAnimated(true) { onResult(null) }
    }
}

private val preparedMedia = mutableMapOf<String, ByteArray>()

@Composable
private fun rememberPickerLauncher(
    mode: MediaCaptureMode,
    sourceType: UIImagePickerControllerSourceType,
    onResult: (String?) -> Unit,
): () -> Unit {
    val latestResult = rememberUpdatedState(onResult)
    val delegate = remember(mode) { MediaPickerDelegate(mode) { latestResult.value(it) } }
    return remember(mode, sourceType, delegate) {
        {
            if (!UIImagePickerController.isSourceTypeAvailable(sourceType)) {
                latestResult.value(null)
                return@remember
            }
            val controller = UIImagePickerController().apply {
                this.sourceType = sourceType
                mediaTypes = listOf(if (mode == MediaCaptureMode.PHOTO) "public.image" else "public.movie")
                this.delegate = delegate
            }
            topViewController()?.presentViewController(controller, true, null)
                ?: latestResult.value(null)
        }
    }
}

@Composable
actual fun rememberPhotoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit =
    rememberPickerLauncher(
        MediaCaptureMode.PHOTO,
        UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera,
        onResult,
    )

@Composable
actual fun rememberVideoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit =
    rememberPickerLauncher(
        MediaCaptureMode.VIDEO,
        UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera,
        onResult,
    )

@Composable
actual fun rememberGalleryPickerLauncher(mode: MediaCaptureMode, onResult: (String?) -> Unit): () -> Unit =
    rememberPickerLauncher(
        mode,
        UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypePhotoLibrary,
        onResult,
    )

@Composable
actual fun rememberUriBytesReader(): (String) -> ByteArray? = { token ->
    preparedMedia.remove(token)
        ?: NSURL.URLWithString(token)?.path?.let { path ->
            NSFileManager.defaultManager.contentsAtPath(path)?.toByteArray()
        }
}

@Composable
actual fun rememberCheckInPhotoReader(): (String) -> ByteArray? = rememberUriBytesReader()
