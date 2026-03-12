package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.presentation.workout.WorkoutViewModel

@Composable
fun WorkoutListScreen(
    workoutViewModel: WorkoutViewModel,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit,
    onWorkoutHistoryClick: () -> Unit
) {
    val state by workoutViewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "WORKOUTS",
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 2.sp
            )
            IconButton(onClick = onWorkoutHistoryClick) {
                Icon(Icons.Default.History, contentDescription = "History", tint = Color.White)
            }
        }

        if (state.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFFA90707))
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.workouts) { workout ->
                    WorkoutCard(workout = workout, onClick = { onWorkoutClick(workout.id) })
                }
                if (state.workouts.isEmpty()) {
                    item {
                        Text(
                            text = "No workouts assigned yet.\nCheck back after your coach sets up your plan.",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 14.sp,
                            lineHeight = 22.sp
                        )
                    }
                }
            }

            // Log Workout button
            Button(
                onClick = onLogWorkoutClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp)
                    .height(52.dp),
                shape = RoundedCornerShape(4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFA90707))
            ) {
                Text("LOG WORKOUT", fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
            }
        }

        state.error?.let {
            Text(
                text = it,
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp,
                modifier = Modifier.padding(24.dp)
            )
        }
    }
}

@Composable
private fun WorkoutCard(workout: Workout, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        workout.dayOfWeek?.let {
            Text(
                text = it.displayName.uppercase(),
                color = Color(0xFFA90707),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.5.sp
            )
        }
        Text(text = workout.name, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = "${workout.exercises.size} exercises",
                color = Color.White.copy(alpha = 0.5f),
                fontSize = 13.sp
            )
            if (workout.durationMinutes > 0) {
                Text(
                    text = "${workout.durationMinutes} min",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 13.sp
                )
            }
        }
    }
}
