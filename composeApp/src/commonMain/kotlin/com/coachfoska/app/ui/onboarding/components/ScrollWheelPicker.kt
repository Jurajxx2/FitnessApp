package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlin.math.abs

/**
 * Vertical wheel picker. Shows [values], snaps the centered item to a fixed centre band, and
 * reports it via [onSelected]. The centred (selected) value is rendered brighter/bolder than its
 * neighbours; every row has the same height so the selection never shifts the layout.
 */
@Composable
fun <T> ScrollWheelPicker(
    values: List<T>,
    selected: T,
    onSelected: (T) -> Unit,
    modifier: Modifier = Modifier,
    label: (T) -> String = { it.toString() }
) {
    val itemHeight = 44.dp
    val visibleCount = 5
    val edgeSpacers = visibleCount / 2          // 2 blank rows top & bottom so items centre
    val initialIndex = values.indexOf(selected).coerceAtLeast(0)
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = initialIndex)
    val snapBehavior = rememberSnapFlingBehavior(listState)

    // Data index whose row centre is nearest the viewport centre. Global list indices are offset
    // by [edgeSpacers] because of the leading blank rows, so subtract it.
    val centeredIndex by remember {
        derivedStateOf {
            if (values.isEmpty()) return@derivedStateOf 0
            val info = listState.layoutInfo
            if (info.visibleItemsInfo.isEmpty()) return@derivedStateOf initialIndex
            val viewportCenter = (info.viewportStartOffset + info.viewportEndOffset) / 2
            val globalIndex = info.visibleItemsInfo
                .minByOrNull { abs((it.offset + it.size / 2) - viewportCenter) }!!.index
            (globalIndex - edgeSpacers).coerceIn(0, values.lastIndex)
        }
    }

    LaunchedEffect(listState) {
        snapshotFlow { centeredIndex }
            .distinctUntilChanged()
            .collect { idx -> values.getOrNull(idx)?.let(onSelected) }
    }

    Box(modifier.height(itemHeight * visibleCount), contentAlignment = Alignment.Center) {
        // Fixed centre selection band.
        Box(
            Modifier
                .fillMaxWidth()
                .height(itemHeight)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
        )
        LazyColumn(
            state = listState,
            flingBehavior = snapBehavior,
            modifier = Modifier.fillMaxWidth()
        ) {
            item { Spacer(Modifier.fillMaxWidth().height(itemHeight)) }
            item { Spacer(Modifier.fillMaxWidth().height(itemHeight)) }
            itemsIndexed(values) { index, value ->
                val isCenter = index == centeredIndex
                Box(
                    Modifier.fillMaxWidth().height(itemHeight),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = label(value),
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = if (isCenter) FontWeight.Bold else FontWeight.Normal,
                        color = if (isCenter) MaterialTheme.colorScheme.onBackground
                                else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                        modifier = Modifier.graphicsLayer {
                            val scale = if (isCenter) 1f else 0.82f
                            scaleX = scale
                            scaleY = scale
                        }
                    )
                }
            }
            item { Spacer(Modifier.fillMaxWidth().height(itemHeight)) }
            item { Spacer(Modifier.fillMaxWidth().height(itemHeight)) }
        }
    }
}
