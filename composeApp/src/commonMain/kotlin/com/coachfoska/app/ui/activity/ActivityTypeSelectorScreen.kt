package com.coachfoska.app.ui.activity

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Pool
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.activity_what_did_you_do
import coachfoska.composeapp.generated.resources.log_activity_title
import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.ui.components.CoachTopBar
import androidx.compose.ui.tooling.preview.Preview
import org.jetbrains.compose.resources.stringResource

@Composable
fun ActivityTypeSelectorRoute(
    onBackClick: () -> Unit,
    onTypeSelected: (ActivityType) -> Unit
) {
    ActivityTypeSelectorScreen(
        onBackClick = onBackClick,
        onTypeSelected = onTypeSelected
    )
}

@Composable
fun ActivityTypeSelectorScreen(
    onBackClick: () -> Unit,
    onTypeSelected: (ActivityType) -> Unit
) {
    Scaffold(
        topBar = {
            CoachTopBar(
                title = stringResource(Res.string.log_activity_title),
                onBackClick = onBackClick
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            Text(
                text = stringResource(Res.string.activity_what_did_you_do),
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                modifier = Modifier.padding(24.dp)
            )

            val types = listOf(
                ActivityType.WALKING to Icons.AutoMirrored.Filled.DirectionsWalk,
                ActivityType.RUNNING to Icons.Filled.DirectionsRun,
                ActivityType.CYCLING to Icons.Filled.DirectionsBike,
                ActivityType.YOGA to Icons.Filled.SelfImprovement,
                ActivityType.SWIMMING to Icons.Filled.Pool,
                ActivityType.OTHER to Icons.Filled.MoreHoriz
            )

            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(types) { (type, icon) ->
                    ActivityTypeCard(
                        type = type,
                        icon = icon,
                        onClick = { onTypeSelected(type) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ActivityTypeCard(
    type: ActivityType,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.aspectRatio(1f)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(16.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = type.displayName,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                textAlign = TextAlign.Center
            )
        }
    }
}

@Preview
@Composable
fun ActivityTypeSelectorPreview() {
    MaterialTheme {
        ActivityTypeSelectorScreen(
            onBackClick = {},
            onTypeSelected = {}
        )
    }
}
