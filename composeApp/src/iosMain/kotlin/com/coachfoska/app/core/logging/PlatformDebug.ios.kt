@file:OptIn(kotlin.experimental.ExperimentalNativeApi::class)

package com.coachfoska.app.core.logging

import kotlin.native.Platform

internal actual val platformIsDebugBuild: Boolean = Platform.isDebugBinary
