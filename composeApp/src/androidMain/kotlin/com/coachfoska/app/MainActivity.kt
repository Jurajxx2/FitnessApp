package com.coachfoska.app

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Health, progress-photo, and chat data can appear throughout the app. A global policy also
        // prevents the OS recents snapshot from retaining those screens.
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        enableEdgeToEdge()
        setContent {
            App(openHumanChat = intent.isChatNotificationTap())
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        recreate()
    }

    private fun Intent.isChatNotificationTap(): Boolean =
        getStringExtra("screen") == "chat" && getStringExtra("chat_type") == "human"
}
