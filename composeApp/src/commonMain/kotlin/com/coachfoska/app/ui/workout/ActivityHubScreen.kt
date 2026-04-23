package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.img_activity_history
import coachfoska.composeapp.generated.resources.img_activity_library
import coachfoska.composeapp.generated.resources.img_activity_plan
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.HubImageCard
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ActivityHubRoute(
    userId: String,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ActivityHubScreen(
        state = state,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onLibraryClick = onLibraryClick
    )
}

@Composable
fun ActivityHubScreen(
    state: WorkoutState,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit
) {
    val planSubtitle = when {
        state.isLoading -> "Loading..."
        state.workouts.isEmpty() -> "No workouts assigned"
        else -> "${state.workouts.size} sessions assigned"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Text(
            text = "ACTIVITY",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp)
        )
        Column(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            HubImageCard(
                imageRes = Res.drawable.img_activity_plan,
                eyebrow = "Plan",
                title = "Today's Workouts",
                subtitle = planSubtitle,
                badge = "TODAY",
                onClick = onPlanClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HubImageCard(
                    imageRes = Res.drawable.img_activity_history,
                    eyebrow = "Log",
                    title = "History",
                    subtitle = "View your sessions",
                    onClick = onHistoryClick,
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                )
                HubImageCard(
                    imageRes = Res.drawable.img_activity_library,
                    eyebrow = "Browse",
                    title = "Library",
                    subtitle = "By category",
                    onClick = onLibraryClick,
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                )
            }
        }
    }
}
