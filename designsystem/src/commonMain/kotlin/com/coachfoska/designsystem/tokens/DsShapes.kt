package com.coachfoska.designsystem.tokens

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.dp

@Immutable
data class DsShapes(
    val xs: CornerBasedShape = RoundedCornerShape(4.dp),
    val sm: CornerBasedShape = RoundedCornerShape(6.dp),
    val md: CornerBasedShape = RoundedCornerShape(8.dp),
    val lg: CornerBasedShape = RoundedCornerShape(10.dp),
    val xl: CornerBasedShape = RoundedCornerShape(12.dp),
    val xxl: CornerBasedShape = RoundedCornerShape(16.dp),
    val full: CornerBasedShape = CircleShape,
)
