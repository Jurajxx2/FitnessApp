import com.codingfeline.buildkonfig.compiler.FieldSpec.Type.BOOLEAN
import com.codingfeline.buildkonfig.compiler.FieldSpec.Type.STRING
import org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.kotlinxSerialization)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.buildkonfig)
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) load(file.inputStream())
}

kotlin {
    androidTarget {
        @OptIn(ExperimentalKotlinGradlePluginApi::class)
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }

    sourceSets {
        commonMain.dependencies {
            // Compose Multiplatform (explicit artifact refs — compose.* accessors removed in 2.3)
            implementation(libs.compose.runtime)
            implementation(libs.compose.foundation)
            implementation(libs.compose.material3)
            implementation(libs.compose.material.icons)
            implementation(libs.compose.ui)
            implementation(libs.compose.components.resources)

            implementation(libs.navigation.compose)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.datetime)
            implementation(libs.coil.compose)
            implementation(libs.coil.network.ktor3)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.client.logging)
            implementation(libs.ktor.serialization.json)

            // Supabase (explicit versions — platform() not allowed in KMP commonMain)
            implementation(libs.supabase.auth)
            implementation(libs.supabase.postgrest)
            implementation(libs.supabase.realtime)
            implementation(libs.supabase.storage)

            // Koin (explicit versions)
            implementation(libs.koin.core)
            implementation(libs.koin.compose)
            implementation(libs.koin.compose.viewmodel)

            // Logging
            implementation(libs.napier)

            // Persistent key-value settings
            implementation(libs.multiplatform.settings)

            // Lottie for Compose Multiplatform
            implementation(libs.compottie)

            // Lifecycle / ViewModel (KMP)
            implementation(libs.lifecycle.viewmodel)
            implementation(libs.lifecycle.viewmodel.compose)
            implementation(libs.lifecycle.runtime.compose)
        }

        androidMain.dependencies {
            implementation(libs.compose.ui.tooling.preview)
            implementation(libs.ktor.client.android)
            implementation(libs.kotlinx.coroutines.android)

            // Koin Android
            implementation(libs.koin.android)

            // Google Sign-In
            implementation(libs.credentials)
            implementation(libs.credentials.play.services)
            implementation(libs.google.identity)

            // WorkManager
            implementation(libs.work.runtime.ktx)
        }

        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
        }

        val androidUnitTest by getting {
            dependencies {
                implementation(libs.mockk)
                implementation(libs.turbine)
                implementation(libs.kotlinx.coroutines.test)
                implementation(kotlin("test"))
            }
        }
    }
}

android {
    namespace = "com.coachfoska.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.coachfoska.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }
}

buildkonfig {
    packageName = "com.coachfoska.app"

    defaultConfigs {
        buildConfigField(
            STRING, "SUPABASE_URL",
            localProperties.getProperty("supabase.url") ?: ""
        )
        buildConfigField(
            STRING, "SUPABASE_ANON_KEY",
            localProperties.getProperty("supabase.anon.key") ?: ""
        )
        buildConfigField(
            STRING, "GOOGLE_WEB_CLIENT_ID",
            localProperties.getProperty("google.web.client.id") ?: ""
        )

        // Chat / AI Coach
        // local.properties keys: anthropic.api.key, ai.coach.enabled, ai.coach.system.prompt
        buildConfigField(
            STRING, "ANTHROPIC_API_KEY",
            localProperties.getProperty("anthropic.api.key") ?: ""
        )
        buildConfigField(
            BOOLEAN, "AI_COACH_ENABLED",
            localProperties.getProperty("ai.coach.enabled") ?: "false"
        )
        buildConfigField(
            STRING, "AI_COACH_SYSTEM_PROMPT",
            localProperties.getProperty("ai.coach.system.prompt")
                ?: "You are a professional fitness and nutrition coach. Provide helpful, evidence-based advice on workouts, nutrition, and healthy habits. Be encouraging, concise, and personalized."
        )
        buildConfigField(
            BOOLEAN, "DEBUG",
            localProperties.getProperty("debug") ?: "false"
        )
    }
}
