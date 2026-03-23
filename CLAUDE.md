# Coach Foška — Project Context

## Overview
Coach Foška is a Kotlin Multiplatform (KMP) fitness and nutrition application for Android and iOS, built with Compose Multiplatform. It uses Supabase for backend services (Auth, Database, Realtime).

## Technology Stack
- **KMP/Compose Multiplatform**: Kotlin 2.3.10, Compose Multiplatform 1.10.2
- **Dependency Injection**: Koin 4.1.1
- **Networking**: Ktor 3.4.1
- **Backend/Database**: Supabase 3.4.1 (Auth, Postgrest, Realtime)
- **Navigation**: Typesafe Jetpack Compose Navigation
- **Image Loading**: Coil 3.3.0
- **Lifecycle/ViewModel**: JetBrains Lifecycle Multiplatform
- **Serialization**: Kotlinx Serialization
- **DateTime**: Kotlinx Datetime
- **Environment Config**: BuildKonfig
- **Logging**: Napier
- **Android Auth**: Credential Manager & Google Identity

## Architecture
The project follows **Clean Architecture** principles:
- **Presentation Layer**: ViewModels (MVI/MVVM pattern), Compose Screens.
- **Domain Layer**: UseCases, Repositories (interfaces), Domain Models.
- **Data Layer**: Repositories (implementations), DataSources (Remote Supabase, API), DTOs.
- **DI**: Koin with multi-module setup (`networkModule`, `dataSourceModule`, etc.).

## Key Features
- **Authentication**: Email OTP, Google/Apple Social Auth.
- **Onboarding**: Multi-step onboarding for new users.
- **Home**: Dashboard with daily workout and nutrition summaries.
- **Workouts**: Assigned workouts, exercise library (by category), workout logging.
- **Nutrition**: Meal plans, meal recording, history, daily macro/calorie summary.
- **Profile**: Progress tracking (weight history), settings.

## Permissions
- All commands starting with `./gradlew` are pre-approved and may be run without asking for permission.
