package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Vertical wheel picker. Shows [values], snaps the centered item, and reports it via [onSelected].
 * The centered (selected) value is rendered larger/brighter than its neighbours.
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
    val initialIndex = values.indexOf(selected).coerceAtLeast(0)
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = initialIndex)

    val centeredIndex by remember {
        derivedStateOf { listState.firstVisibleItemIndex }
    }

    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .collect { idx -> values.getOrNull(idx)?.let(onSelected) }
    }

    Box(modifier.height(itemHeight * visibleCount), contentAlignment = Alignment.Center) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = itemHeight * 2)
        ) {
            itemsIndexed(values) { index, value ->
                val isCenter = index == centeredIndex
                Text(
                    text = label(value),
                    textAlign = TextAlign.Center,
                    style = if (isCenter) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.bodyLarge,
                    fontWeight = if (isCenter) FontWeight.Bold else FontWeight.Normal,
                    color = if (isCenter) MaterialTheme.colorScheme.onBackground
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().height(itemHeight).padding(top = 8.dp)
                )
            }
        }
    }
}
