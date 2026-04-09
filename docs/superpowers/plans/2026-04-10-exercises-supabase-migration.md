# Exercises — Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wger.de exercise API with a self-hosted Supabase exercise library, including a one-time import script and a new admin panel Exercises tab.

**Architecture:** New Supabase tables (`exercises`, `exercise_categories`, `muscles`, `equipment`, `exercise_muscles`, `exercise_equipment`) replace all wger API calls. `ExerciseSupabaseDataSource` replaces `ExerciseApiDataSource` behind the same `ExerciseRepository` interface, so use cases and ViewModels need only minor type changes (exercise ID: `Int` → `String`). Admin panel gets a new Exercises page following the Quotes/Workouts page pattern.

**Tech Stack:** Kotlin Multiplatform, Compose Multiplatform, Supabase Kotlin client (postgrest), Koin, MockK (tests), React + TypeScript + TanStack Query (admin panel), Node.js (import script).

---

## File Map

### Modified (KMP app)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Exercise.kt` — rename `WgerExercise` → `Exercise`, `id: Int` → `id: String`, add `difficulty` field
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/ExerciseRepository.kt` — `getExerciseById(id: String)`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/exercise/GetExerciseByIdUseCase.kt` — `invoke(id: String)`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/exercise/GetExercisesByCategoryUseCase.kt` — return type `Exercise` instead of `WgerExercise`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/exercise/SearchExercisesUseCase.kt` — return type `Exercise`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/exercise/GetExerciseCategoriesUseCase.kt` — unchanged (return type already `ExerciseCategory`)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/ExerciseRepositoryImpl.kt` — swap data source
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/exercise/ExerciseState.kt` — `WgerExercise` → `Exercise`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/exercise/ExerciseIntent.kt` — `SelectExercise(exerciseId: Int)` → `SelectExercise(exerciseId: String)`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/exercise/ExerciseViewModel.kt` — `loadExerciseDetail(id: String)`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt` — `ExerciseDetail(exerciseId: Int)` → `ExerciseDetail(exerciseId: String)`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt` — update `ExerciseDetail` nav call sites
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseByCategoryScreen.kt` — `onExerciseClick: (String)`, import `Exercise`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt` — `exerciseId: String`, import `Exercise`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` — remove `ExerciseApiDataSource`, add `ExerciseSupabaseDataSource`

### Created (KMP app)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ExerciseSupabaseDataSource.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/ExerciseSupabaseDto.kt`

### Deleted (KMP app)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ExerciseApiDataSource.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/WgerExerciseDto.kt`

### Created (tests)
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/ExerciseRepositoryImplTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/exercise/ExerciseUseCasesTest.kt`

### Modified (admin panel)
- `admin/src/types/database.ts` — add `ExerciseCategory`, `Muscle`, `Equipment`, `Exercise` types
- `admin/src/components/Sidebar.tsx` — add Exercises nav item
- `admin/src/App.tsx` — add `/admin/exercises` route

### Created (admin panel)
- `admin/src/pages/admin/Exercises.tsx`

### Created (import script)
- `scripts/import-exercises/package.json`
- `scripts/import-exercises/import.js`

---

## Task 1: Supabase migration — create tables and storage bucket

**Files:**
- Create: `supabase/migrations/20260410000000_exercises.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260410000000_exercises.sql

create table exercise_categories (
  id   int primary key,
  name text not null
);

create table muscles (
  id       int primary key,
  name     text not null,
  is_front bool not null default true
);

create table equipment (
  id   int primary key,
  name text not null
);

create table exercises (
  id              uuid primary key default gen_random_uuid(),
  name_en         text not null,
  description_en  text not null default '',
  name_cs         text,
  description_cs  text,
  category_id     int references exercise_categories(id),
  image_url       text,
  video_url       text,
  difficulty      text,
  is_active       bool not null default true,
  wger_id         int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table exercise_muscles (
  exercise_id uuid references exercises(id) on delete cascade,
  muscle_id   int  references muscles(id),
  is_primary  bool not null default true,
  primary key (exercise_id, muscle_id, is_primary)
);

create table exercise_equipment (
  exercise_id  uuid references exercises(id) on delete cascade,
  equipment_id int  references equipment(id),
  primary key (exercise_id, equipment_id)
);

alter table workout_exercises
  add column exercise_id uuid references exercises(id) on delete set null;

-- Enable RLS (admin writes, app reads)
alter table exercise_categories enable row level security;
alter table muscles              enable row level security;
alter table equipment            enable row level security;
alter table exercises            enable row level security;
alter table exercise_muscles     enable row level security;
alter table exercise_equipment   enable row level security;

-- Public read for authenticated users
create policy "authenticated read exercise_categories" on exercise_categories for select to authenticated using (true);
create policy "authenticated read muscles"             on muscles             for select to authenticated using (true);
create policy "authenticated read equipment"           on equipment           for select to authenticated using (true);
create policy "authenticated read exercises"           on exercises           for select to authenticated using (is_active = true);
create policy "authenticated read exercise_muscles"    on exercise_muscles    for select to authenticated using (true);
create policy "authenticated read exercise_equipment"  on exercise_equipment  for select to authenticated using (true);
```

- [ ] **Step 2: Apply the migration**

Run in Supabase SQL editor or via CLI:
```bash
supabase db push
```
Or paste the SQL directly into the Supabase dashboard → SQL Editor.

- [ ] **Step 3: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `exercises`
- Public: ✅ (enable public access)
- Allowed MIME types: `image/png, image/jpeg, image/webp`

Or via SQL:
```sql
insert into storage.buckets (id, name, public)
values ('exercises', 'exercises', true);

create policy "public read exercises bucket" on storage.objects
  for select using (bucket_id = 'exercises');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260410000000_exercises.sql
git commit -m "feat(db): add exercises tables migration and storage bucket"
```

---

## Task 2: Domain model — rename WgerExercise to Exercise

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Exercise.kt`

- [ ] **Step 1: Replace the file content**

```kotlin
package com.coachfoska.app.domain.model

data class Exercise(
    val id: String,
    val name: String,
    val description: String,
    val category: ExerciseCategory?,
    val muscles: List<Muscle>,
    val musclesSecondary: List<Muscle>,
    val equipment: List<Equipment>,
    val imageUrl: String?,
    val videoUrl: String?,
    val difficulty: String?
)

data class ExerciseCategory(
    val id: Int,
    val name: String
)

data class Muscle(
    val id: Int,
    val name: String,
    val isFront: Boolean
)

data class Equipment(
    val id: Int,
    val name: String
)
```

- [ ] **Step 2: Verify the build compiles (will fail — that's expected)**

```bash
./gradlew :composeApp:compileKotlinAndroid 2>&1 | grep -E "error:|WgerExercise" | head -30
```

Expected: errors referencing `WgerExercise` — these are fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Exercise.kt
git commit -m "feat(domain): rename WgerExercise to Exercise, add difficulty field, id String"
```

---

## Task 3: New Supabase DTOs

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/ExerciseSupabaseDto.kt`
- Delete: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/WgerExerciseDto.kt`

- [ ] **Step 1: Create the new DTO file**

```kotlin
package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.Equipment
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.model.Muscle
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ExerciseDto(
    val id: String,
    @SerialName("name_en") val nameEn: String,
    @SerialName("description_en") val descriptionEn: String = "",
    @SerialName("name_cs") val nameCsRaw: String? = null,
    @SerialName("description_cs") val descriptionCsRaw: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    val difficulty: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("exercise_categories") val category: ExerciseCategoryDto? = null,
    @SerialName("exercise_muscles") val exerciseMuscles: List<ExerciseMuscleDto> = emptyList(),
    @SerialName("exercise_equipment") val exerciseEquipment: List<ExerciseEquipmentDto> = emptyList()
) {
    fun toDomain(locale: String = "en"): Exercise {
        val name = if (locale == "cs" && !nameCsRaw.isNullOrBlank()) nameCsRaw else nameEn
        val description = if (locale == "cs" && !descriptionCsRaw.isNullOrBlank()) descriptionCsRaw else descriptionEn
        return Exercise(
            id = id,
            name = name,
            description = description,
            category = category?.toDomain(),
            muscles = exerciseMuscles.filter { it.isPrimary }.mapNotNull { it.muscle?.toDomain() },
            musclesSecondary = exerciseMuscles.filter { !it.isPrimary }.mapNotNull { it.muscle?.toDomain() },
            equipment = exerciseEquipment.mapNotNull { it.equipment?.toDomain() },
            imageUrl = imageUrl,
            videoUrl = videoUrl,
            difficulty = difficulty
        )
    }
}

@Serializable
data class ExerciseCategoryDto(
    val id: Int,
    val name: String
) {
    fun toDomain() = ExerciseCategory(id = id, name = name)
}

@Serializable
data class ExerciseMuscleDto(
    @SerialName("is_primary") val isPrimary: Boolean = true,
    val muscles: MuscleDto? = null
) {
    // Supabase returns the joined row under the FK table name
    val muscle: MuscleDto? get() = muscles
}

@Serializable
data class MuscleDto(
    val id: Int,
    val name: String,
    @SerialName("is_front") val isFront: Boolean = true
) {
    fun toDomain() = Muscle(id = id, name = name, isFront = isFront)
}

@Serializable
data class ExerciseEquipmentDto(
    val equipment: EquipmentDto? = null
)

@Serializable
data class EquipmentDto(
    val id: Int,
    val name: String
) {
    fun toDomain() = Equipment(id = id, name = name)
}
```

- [ ] **Step 2: Delete the old wger DTO file**

```bash
rm composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/WgerExerciseDto.kt
```

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/ExerciseSupabaseDto.kt
git rm composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/WgerExerciseDto.kt
git commit -m "feat(dto): add ExerciseSupabaseDto, remove WgerExerciseDto"
```

---

## Task 4: ExerciseSupabaseDataSource

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ExerciseSupabaseDataSource.kt`

- [ ] **Step 1: Create the data source**

```kotlin
package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.ExerciseCategoryDto
import com.coachfoska.app.data.remote.dto.ExerciseDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns

private const val EXERCISE_COLUMNS = """
    *,
    exercise_categories(id, name),
    exercise_muscles(is_primary, muscles(id, name, is_front)),
    exercise_equipment(equipment(id, name))
""".trimIndent()

class ExerciseSupabaseDataSource(private val supabase: SupabaseClient) {

    suspend fun getCategories(): List<ExerciseCategoryDto> =
        supabase.postgrest["exercise_categories"]
            .select {
                order("name")
            }
            .decodeList()

    suspend fun getExercisesByCategory(categoryId: Int): List<ExerciseDto> =
        supabase.postgrest["exercises"]
            .select(columns = Columns.raw(EXERCISE_COLUMNS)) {
                filter {
                    eq("category_id", categoryId)
                    eq("is_active", true)
                }
                order("name_en")
            }
            .decodeList()

    suspend fun getExerciseById(id: String): ExerciseDto =
        supabase.postgrest["exercises"]
            .select(columns = Columns.raw(EXERCISE_COLUMNS)) {
                filter { eq("id", id) }
            }
            .decodeSingle()

    suspend fun searchExercises(query: String): List<ExerciseDto> =
        supabase.postgrest["exercises"]
            .select(columns = Columns.raw(EXERCISE_COLUMNS)) {
                filter {
                    or {
                        ilike("name_en", "%$query%")
                        ilike("name_cs", "%$query%")
                    }
                    eq("is_active", true)
                }
                limit(20)
            }
            .decodeList()
}
```

- [ ] **Step 2: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ExerciseSupabaseDataSource.kt
git commit -m "feat(datasource): add ExerciseSupabaseDataSource replacing wger API"
```

---

## Task 5: Update ExerciseRepository interface and ExerciseRepositoryImpl

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/ExerciseRepository.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/ExerciseRepositoryImpl.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/ExerciseRepositoryImplTest.kt`

- [ ] **Step 1: Write the failing test first**

```kotlin
// composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/ExerciseRepositoryImplTest.kt
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.ExerciseSupabaseDataSource
import com.coachfoska.app.data.remote.dto.ExerciseCategoryDto
import com.coachfoska.app.data.remote.dto.ExerciseDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ExerciseRepositoryImplTest {

    private val dataSource: ExerciseSupabaseDataSource = mockk()
    private val repository = ExerciseRepositoryImpl(dataSource)

    @Test
    fun `getCategories maps DTOs to domain models`() = runTest {
        coEvery { dataSource.getCategories() } returns listOf(
            ExerciseCategoryDto(id = 1, name = "Chest"),
            ExerciseCategoryDto(id = 2, name = "Back")
        )

        val result = repository.getCategories()

        assertTrue(result.isSuccess)
        val cats = result.getOrThrow()
        assertEquals(2, cats.size)
        assertEquals(1, cats[0].id)
        assertEquals("Chest", cats[0].name)
    }

    @Test
    fun `getCategories propagates exception`() = runTest {
        coEvery { dataSource.getCategories() } throws RuntimeException("DB error")

        val result = repository.getCategories()

        assertTrue(result.isFailure)
        assertEquals("DB error", result.exceptionOrNull()?.message)
    }

    @Test
    fun `getExercisesByCategory maps DTOs and passes locale`() = runTest {
        val dto = anExerciseDto(id = "uuid-1", nameEn = "Bench Press")
        coEvery { dataSource.getExercisesByCategory(1) } returns listOf(dto)

        val result = repository.getExercisesByCategory(1)

        assertTrue(result.isSuccess)
        val exercises = result.getOrThrow()
        assertEquals(1, exercises.size)
        assertEquals("uuid-1", exercises[0].id)
        assertEquals("Bench Press", exercises[0].name)
    }

    @Test
    fun `getExerciseById maps single DTO`() = runTest {
        val dto = anExerciseDto(id = "uuid-1", nameEn = "Squat")
        coEvery { dataSource.getExerciseById("uuid-1") } returns dto

        val result = repository.getExerciseById("uuid-1")

        assertTrue(result.isSuccess)
        assertEquals("uuid-1", result.getOrThrow().id)
        assertEquals("Squat", result.getOrThrow().name)
    }

    @Test
    fun `searchExercises maps results`() = runTest {
        coEvery { dataSource.searchExercises("press") } returns listOf(anExerciseDto(nameEn = "Bench Press"))

        val result = repository.searchExercises("press")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
    }

    @Test
    fun `searchExercises blank query returns empty without calling datasource`() = runTest {
        val result = repository.searchExercises("  ")

        assertTrue(result.isSuccess)
        assertEquals(emptyList(), result.getOrThrow())
        coVerify(exactly = 0) { dataSource.searchExercises(any()) }
    }
}

private fun anExerciseDto(
    id: String = "uuid-1",
    nameEn: String = "Exercise"
) = ExerciseDto(
    id = id,
    nameEn = nameEn,
    descriptionEn = "Description"
)
```

- [ ] **Step 2: Run the test — expect compilation failure**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.repository.ExerciseRepositoryImplTest" 2>&1 | tail -20
```

Expected: compilation error about missing `ExerciseRepositoryImpl(ExerciseSupabaseDataSource)` constructor.

- [ ] **Step 3: Update ExerciseRepository interface**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/ExerciseRepository.kt
package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory

interface ExerciseRepository {
    suspend fun searchExercises(query: String): Result<List<Exercise>>
    suspend fun getExerciseById(id: String): Result<Exercise>
    suspend fun getCategories(): Result<List<ExerciseCategory>>
    suspend fun getExercisesByCategory(categoryId: Int): Result<List<Exercise>>
}
```

- [ ] **Step 4: Update ExerciseRepositoryImpl**

```kotlin
// composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/ExerciseRepositoryImpl.kt
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.ExerciseSupabaseDataSource
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository

class ExerciseRepositoryImpl(
    private val dataSource: ExerciseSupabaseDataSource
) : ExerciseRepository {

    override suspend fun searchExercises(query: String): Result<List<Exercise>> {
        if (query.isBlank()) return Result.success(emptyList())
        return runCatching { dataSource.searchExercises(query.trim()).map { it.toDomain() } }
    }

    override suspend fun getExerciseById(id: String): Result<Exercise> = runCatching {
        dataSource.getExerciseById(id).toDomain()
    }

    override suspend fun getCategories(): Result<List<ExerciseCategory>> = runCatching {
        dataSource.getCategories().map { it.toDomain() }
    }

    override suspend fun getExercisesByCategory(categoryId: Int): Result<List<Exercise>> = runCatching {
        dataSource.getExercisesByCategory(categoryId).map { it.toDomain() }
    }
}
```

- [ ] **Step 5: Run the tests — expect PASS**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.repository.ExerciseRepositoryImplTest"
```

Expected: all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/ExerciseRepository.kt
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/ExerciseRepositoryImpl.kt
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/ExerciseRepositoryImplTest.kt
git commit -m "feat(repo): ExerciseRepositoryImpl now uses Supabase datasource"
```

---

## Task 6: Update use cases and their tests

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/exercise/GetExerciseByIdUseCase.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/exercise/GetExercisesByCategoryUseCase.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/exercise/SearchExercisesUseCase.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/exercise/GetExerciseCategoriesUseCase.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/exercise/ExerciseUseCasesTest.kt`

- [ ] **Step 1: Write the failing tests**

```kotlin
// composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/exercise/ExerciseUseCasesTest.kt
package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GetExerciseByIdUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = GetExerciseByIdUseCase(repo)

    @Test
    fun `delegates to repo with string id`() = runTest {
        val exercise = anExercise(id = "uuid-abc")
        coEvery { repo.getExerciseById("uuid-abc") } returns Result.success(exercise)

        val result = useCase("uuid-abc")

        assertTrue(result.isSuccess)
        assertEquals(exercise, result.getOrNull())
        coVerify { repo.getExerciseById("uuid-abc") }
    }

    @Test
    fun `propagates repo failure`() = runTest {
        coEvery { repo.getExerciseById(any()) } returns Result.failure(RuntimeException("not found"))

        val result = useCase("uuid-abc")

        assertTrue(result.isFailure)
    }
}

class GetExercisesByCategoryUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = GetExercisesByCategoryUseCase(repo)

    @Test
    fun `delegates to repo with category id`() = runTest {
        val exercises = listOf(anExercise(), anExercise(id = "uuid-2"))
        coEvery { repo.getExercisesByCategory(3) } returns Result.success(exercises)

        val result = useCase(3)

        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrThrow().size)
        coVerify { repo.getExercisesByCategory(3) }
    }
}

class SearchExercisesUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = SearchExercisesUseCase(repo)

    @Test
    fun `blank query returns empty without calling repo`() = runTest {
        val result = useCase("   ")

        assertTrue(result.isSuccess)
        assertEquals(emptyList(), result.getOrNull())
        coVerify(exactly = 0) { repo.searchExercises(any()) }
    }

    @Test
    fun `non-blank query delegates trimmed query to repo`() = runTest {
        coEvery { repo.searchExercises("bench") } returns Result.success(listOf(anExercise()))

        val result = useCase("  bench  ")

        assertTrue(result.isSuccess)
        coVerify { repo.searchExercises("bench") }
    }
}

class GetExerciseCategoriesUseCaseTest {
    private val repo = mockk<ExerciseRepository>()
    private val useCase = GetExerciseCategoriesUseCase(repo)

    @Test
    fun `delegates to repo`() = runTest {
        val cats = listOf(ExerciseCategory(1, "Chest"), ExerciseCategory(2, "Back"))
        coEvery { repo.getCategories() } returns Result.success(cats)

        val result = useCase()

        assertTrue(result.isSuccess)
        assertEquals(cats, result.getOrNull())
    }
}

private fun anExercise(id: String = "uuid-1") = Exercise(
    id = id, name = "Bench Press", description = "", category = null,
    muscles = emptyList(), musclesSecondary = emptyList(), equipment = emptyList(),
    imageUrl = null, videoUrl = null, difficulty = null
)
```

- [ ] **Step 2: Run — expect compilation failure**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.exercise.*" 2>&1 | tail -20
```

Expected: compilation error about `invoke(id: Int)` mismatch.

- [ ] **Step 3: Update all four use cases**

```kotlin
// GetExerciseByIdUseCase.kt
package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class GetExerciseByIdUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(id: String): Result<Exercise> =
        exerciseRepository.getExerciseById(id)
}
```

```kotlin
// GetExercisesByCategoryUseCase.kt
package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class GetExercisesByCategoryUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(categoryId: Int): Result<List<Exercise>> =
        exerciseRepository.getExercisesByCategory(categoryId)
}
```

```kotlin
// SearchExercisesUseCase.kt
package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class SearchExercisesUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(query: String): Result<List<Exercise>> {
        if (query.isBlank()) return Result.success(emptyList())
        return exerciseRepository.searchExercises(query.trim())
    }
}
```

```kotlin
// GetExerciseCategoriesUseCase.kt  (unchanged logic, update import only)
package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository

class GetExerciseCategoriesUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(): Result<List<ExerciseCategory>> = exerciseRepository.getCategories()
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.exercise.*"
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/exercise/
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/exercise/ExerciseUseCasesTest.kt
git commit -m "feat(usecase): update exercise use cases for String id and Exercise type"
```

---

## Task 7: Update presentation layer (Intent, State, ViewModel)

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/exercise/ExerciseIntent.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/exercise/ExerciseState.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/exercise/ExerciseViewModel.kt`

- [ ] **Step 1: Update ExerciseIntent.kt**

```kotlin
package com.coachfoska.app.presentation.exercise

sealed interface ExerciseIntent {
    data class SearchQueryChanged(val query: String) : ExerciseIntent
    data object Search : ExerciseIntent
    data class SelectExercise(val exerciseId: String) : ExerciseIntent
    data object ClearSelection : ExerciseIntent
    data object LoadCategories : ExerciseIntent
    data class LoadExercisesByCategory(val categoryId: Int) : ExerciseIntent
    data object DismissError : ExerciseIntent
}
```

- [ ] **Step 2: Update ExerciseState.kt**

```kotlin
package com.coachfoska.app.presentation.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory

data class ExerciseState(
    val searchQuery: String = "",
    val isSearching: Boolean = false,
    val searchResults: List<Exercise> = emptyList(),
    val selectedExercise: Exercise? = null,
    val isLoadingDetail: Boolean = false,
    val categories: List<ExerciseCategory> = emptyList(),
    val isCategoriesLoading: Boolean = false,
    val categoryExercises: List<Exercise> = emptyList(),
    val isCategoryExercisesLoading: Boolean = false,
    val error: String? = null
)
```

- [ ] **Step 3: Update ExerciseViewModel.kt**

```kotlin
package com.coachfoska.app.presentation.exercise

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.exercise.GetExerciseByIdUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExerciseCategoriesUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExercisesByCategoryUseCase
import com.coachfoska.app.domain.usecase.exercise.SearchExercisesUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ExerciseViewModel"

class ExerciseViewModel(
    private val searchExercisesUseCase: SearchExercisesUseCase,
    private val getExerciseByIdUseCase: GetExerciseByIdUseCase,
    private val getExerciseCategoriesUseCase: GetExerciseCategoriesUseCase,
    private val getExercisesByCategoryUseCase: GetExercisesByCategoryUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(ExerciseState())
    val state: StateFlow<ExerciseState> = _state.asStateFlow()

    fun onIntent(intent: ExerciseIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            is ExerciseIntent.SearchQueryChanged -> _state.update { it.copy(searchQuery = intent.query) }
            ExerciseIntent.Search -> search()
            is ExerciseIntent.SelectExercise -> loadExerciseDetail(intent.exerciseId)
            ExerciseIntent.ClearSelection -> _state.update { it.copy(selectedExercise = null) }
            ExerciseIntent.LoadCategories -> loadCategories()
            is ExerciseIntent.LoadExercisesByCategory -> loadExercisesByCategory(intent.categoryId)
            ExerciseIntent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun search() {
        viewModelScope.launch {
            _state.update { it.copy(isSearching = true, error = null) }
            searchExercisesUseCase(_state.value.searchQuery)
                .onSuccess { results -> _state.update { it.copy(isSearching = false, searchResults = results) } }
                .onFailure { e ->
                    Napier.e("search failed", e, tag = TAG)
                    _state.update { it.copy(isSearching = false, error = e.message) }
                }
        }
    }

    private fun loadCategories() {
        if (_state.value.categories.isNotEmpty()) return
        viewModelScope.launch {
            _state.update { it.copy(isCategoriesLoading = true, error = null) }
            getExerciseCategoriesUseCase()
                .onSuccess { cats -> _state.update { it.copy(isCategoriesLoading = false, categories = cats) } }
                .onFailure { e ->
                    Napier.e("loadCategories failed", e, tag = TAG)
                    _state.update { it.copy(isCategoriesLoading = false, error = e.message) }
                }
        }
    }

    private fun loadExercisesByCategory(categoryId: Int) {
        viewModelScope.launch {
            _state.update { it.copy(isCategoryExercisesLoading = true, categoryExercises = emptyList(), error = null) }
            getExercisesByCategoryUseCase(categoryId)
                .onSuccess { exercises -> _state.update { it.copy(isCategoryExercisesLoading = false, categoryExercises = exercises) } }
                .onFailure { e ->
                    Napier.e("loadExercisesByCategory($categoryId) failed", e, tag = TAG)
                    _state.update { it.copy(isCategoryExercisesLoading = false, error = e.message) }
                }
        }
    }

    private fun loadExerciseDetail(id: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoadingDetail = true) }
            getExerciseByIdUseCase(id)
                .onSuccess { exercise -> _state.update { it.copy(isLoadingDetail = false, selectedExercise = exercise) } }
                .onFailure { e ->
                    Napier.e("loadExerciseDetail($id) failed", e, tag = TAG)
                    _state.update { it.copy(isLoadingDetail = false, error = e.message) }
                }
        }
    }
}
```

- [ ] **Step 4: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid 2>&1 | grep -E "error:" | head -20
```

Expected: errors only in UI/navigation files (Routes.kt, App.kt, screens) — not in ViewModel/domain.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/exercise/
git commit -m "feat(presentation): update ExerciseIntent/State/ViewModel for String id"
```

---

## Task 8: Update navigation routes and UI screens

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseByCategoryScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt`

- [ ] **Step 1: Update Routes.kt — change ExerciseDetail id type**

In `Routes.kt`, change:
```kotlin
@Serializable data class ExerciseDetail(val exerciseId: Int)
```
to:
```kotlin
@Serializable data class ExerciseDetail(val exerciseId: String)
```

- [ ] **Step 2: Update ExerciseByCategoryScreen.kt**

Change the `onExerciseClick` lambda type from `(Int) -> Unit` to `(String) -> Unit` and update the `ExerciseListItem` import from `WgerExercise` to `Exercise`:

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseState
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun ExerciseByCategoryRoute(
    categoryId: Int,
    categoryName: String,
    onExerciseClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: ExerciseViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(categoryId) {
        viewModel.onIntent(ExerciseIntent.LoadExercisesByCategory(categoryId))
    }

    ExerciseByCategoryScreen(
        categoryName = categoryName,
        state = state,
        onExerciseClick = onExerciseClick,
        onBackClick = onBackClick
    )
}

@Composable
fun ExerciseByCategoryScreen(
    categoryName: String,
    state: ExerciseState,
    onExerciseClick: (String) -> Unit,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        when {
            state.isCategoryExercisesLoading -> CoachLoadingBox()
            state.error != null -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = state.error,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 14.sp
                    )
                }
            }
            else -> {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(state.categoryExercises) { exercise ->
                        ExerciseListItem(
                            exercise = exercise,
                            onClick = { onExerciseClick(exercise.id) }
                        )
                    }
                    if (state.categoryExercises.isEmpty()) {
                        item {
                            Text(
                                text = "No exercises found for this category.",
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ExerciseListItem(exercise: Exercise, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(10.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = exercise.name,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium
            )
            if (exercise.muscles.isNotEmpty()) {
                Text(
                    text = exercise.muscles.joinToString(", ") { it.name },
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    fontSize = 12.sp
                )
            }
        }
        Text(
            text = "›",
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
            fontSize = 20.sp
        )
    }
}
```

- [ ] **Step 3: Update ExerciseDetailScreen.kt — change exerciseId parameter type**

Change `exerciseId: Int` to `exerciseId: String` in `ExerciseDetailRoute`:

```kotlin
@Composable
fun ExerciseDetailRoute(
    exerciseId: String,
    onBackClick: () -> Unit,
    viewModel: ExerciseViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(exerciseId) {
        viewModel.onIntent(ExerciseIntent.SelectExercise(exerciseId))
    }

    ExerciseDetailScreen(state = state, onBackClick = onBackClick)
}
```

The rest of `ExerciseDetailScreen.kt` is unchanged — it reads from `state.selectedExercise` which is now `Exercise` instead of `WgerExercise`, same field names.

- [ ] **Step 4: Update App.kt — fix ExerciseDetail nav call sites**

Find the two lines in `App.kt` that navigate to `ExerciseDetail` and pass an `Int`. Both are already providing `exercise.id` (which is now a `String`) or `exerciseId` from the route. Update:

Line ~292 in `App.kt` (inside `WorkoutList composable`):
```kotlin
onExerciseClick = { exerciseId -> navController.navigate(ExerciseDetail(exerciseId)) }
```
This passes `exerciseId` directly — no change needed to the lambda itself, but the route parameter type now matches `String`.

Line ~304 in `App.kt` (inside `ExercisesByCategory composable`):
```kotlin
onExerciseClick = { exerciseId -> navController.navigate(ExerciseDetail(exerciseId)) }
```
Same — no change needed.

Line ~309-313: Update the `ExerciseDetail` composable registration:
```kotlin
composable<ExerciseDetail> { backStackEntry ->
    val route = backStackEntry.toRoute<ExerciseDetail>()
    ExerciseDetailRoute(
        exerciseId = route.exerciseId,
        onBackClick = { navController.popBackStack() }
    )
}
```
No functional change needed here — just verify `route.exerciseId` is now `String` which matches `ExerciseDetailRoute(exerciseId: String)`.

- [ ] **Step 5: Verify full compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid 2>&1 | grep "error:" | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseByCategoryScreen.kt
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt
git commit -m "feat(ui): update exercise screens and nav for String exercise id"
```

---

## Task 9: DI wiring and remove dead code

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`
- Delete: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ExerciseApiDataSource.kt`

- [ ] **Step 1: Update AppModule.kt**

In `dataSourceModule`, replace:
```kotlin
single { ExerciseApiDataSource(get()) }
```
with:
```kotlin
single { ExerciseSupabaseDataSource(get()) }
```

Remove the import for `ExerciseApiDataSource` and add the import for `ExerciseSupabaseDataSource`.

The `HttpClient` stays in `networkModule` — it is still used by `ClaudeAiProvider`.

Full updated imports section (exercise-related changes only):
```kotlin
// Remove:
import com.coachfoska.app.data.remote.datasource.ExerciseApiDataSource
// Add:
import com.coachfoska.app.data.remote.datasource.ExerciseSupabaseDataSource
```

And in `repositoryModule`, `ExerciseRepositoryImpl(get())` now resolves `ExerciseSupabaseDataSource` — no change needed.

- [ ] **Step 2: Delete ExerciseApiDataSource.kt**

```bash
rm composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ExerciseApiDataSource.kt
```

- [ ] **Step 3: Run all tests**

```bash
./gradlew :composeApp:testDebugUnitTest
```

Expected: all existing tests pass, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt
git rm composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ExerciseApiDataSource.kt
git commit -m "feat(di): wire ExerciseSupabaseDataSource, remove ExerciseApiDataSource"
```

---

## Task 10: Admin panel — types and Exercises page

**Files:**
- Modify: `admin/src/types/database.ts`
- Create: `admin/src/pages/admin/Exercises.tsx`
- Modify: `admin/src/components/Sidebar.tsx`
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Add new types to database.ts**

Append to the end of `admin/src/types/database.ts`:

```typescript
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface ExerciseCategory {
  id: number
  name: string
}

export interface Muscle {
  id: number
  name: string
  is_front: boolean
}

export interface Equipment {
  id: number
  name: string
}

export interface Exercise {
  id: string
  name_en: string
  description_en: string
  name_cs: string | null
  description_cs: string | null
  category_id: number | null
  image_url: string | null
  video_url: string | null
  difficulty: Difficulty | null
  is_active: boolean
  wger_id: number | null
  created_at: string
  updated_at: string
}

export interface ExerciseMuscle {
  exercise_id: string
  muscle_id: number
  is_primary: boolean
}
```

- [ ] **Step 2: Create Exercises.tsx**

```tsx
// admin/src/pages/admin/Exercises.tsx
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Input, Modal, Table, Th, Td } from '../../components/ui'
import { useAdminLayoutActions } from '../../components/AdminLayout'
import type { Exercise, ExerciseCategory, Muscle, Equipment, Difficulty } from '../../types/database'

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']

function useExercises(search: string, categoryId: number | null) {
  return useQuery<Exercise[]>({
    queryKey: ['exercises-admin', search, categoryId],
    queryFn: async () => {
      let q = supabase.from('exercises').select('*').order('name_en')
      if (search) q = q.ilike('name_en', `%${search}%`)
      if (categoryId !== null) q = q.eq('category_id', categoryId)
      const { data } = await q
      return data ?? []
    },
  })
}

function useCategories() {
  return useQuery<ExerciseCategory[]>({
    queryKey: ['exercise-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('exercise_categories').select('*').order('name')
      return data ?? []
    },
  })
}

function useMuscles() {
  return useQuery<Muscle[]>({
    queryKey: ['muscles'],
    queryFn: async () => {
      const { data } = await supabase.from('muscles').select('*').order('name')
      return data ?? []
    },
  })
}

function useEquipment() {
  return useQuery<Equipment[]>({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data } = await supabase.from('equipment').select('*').order('name')
      return data ?? []
    },
  })
}

interface ExerciseFormState {
  name_en: string
  description_en: string
  name_cs: string
  description_cs: string
  category_id: string
  image_url: string
  video_url: string
  difficulty: string
  is_active: boolean
}

const blankForm = (): ExerciseFormState => ({
  name_en: '', description_en: '', name_cs: '', description_cs: '',
  category_id: '', image_url: '', video_url: '', difficulty: '', is_active: true,
})

export default function Exercises() {
  const qc = useQueryClient()
  const { setActions } = useAdminLayoutActions()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [form, setForm] = useState<ExerciseFormState>(blankForm())
  const [primaryMuscles, setPrimaryMuscles] = useState<number[]>([])
  const [secondaryMuscles, setSecondaryMuscles] = useState<number[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<number[]>([])

  const { data: exercises = [], isLoading } = useExercises(search, filterCategory)
  const { data: categories = [] } = useCategories()
  const { data: muscles = [] } = useMuscles()
  const { data: equipment = [] } = useEquipment()

  function openCreate() {
    setEditing(null)
    setForm(blankForm())
    setPrimaryMuscles([])
    setSecondaryMuscles([])
    setSelectedEquipment([])
    setEditorOpen(true)
  }

  async function openEdit(ex: Exercise) {
    setEditing(ex)
    setForm({
      name_en: ex.name_en,
      description_en: ex.description_en,
      name_cs: ex.name_cs ?? '',
      description_cs: ex.description_cs ?? '',
      category_id: ex.category_id?.toString() ?? '',
      image_url: ex.image_url ?? '',
      video_url: ex.video_url ?? '',
      difficulty: ex.difficulty ?? '',
      is_active: ex.is_active,
    })
    const [musclesRes, equipmentRes] = await Promise.all([
      supabase.from('exercise_muscles').select('*').eq('exercise_id', ex.id),
      supabase.from('exercise_equipment').select('*').eq('exercise_id', ex.id),
    ])
    setPrimaryMuscles((musclesRes.data ?? []).filter(m => m.is_primary).map(m => m.muscle_id))
    setSecondaryMuscles((musclesRes.data ?? []).filter(m => !m.is_primary).map(m => m.muscle_id))
    setSelectedEquipment((equipmentRes.data ?? []).map(e => e.equipment_id))
    setEditorOpen(true)
  }

  const saveExercise = useMutation({
    mutationFn: async () => {
      const payload = {
        name_en: form.name_en,
        description_en: form.description_en,
        name_cs: form.name_cs || null,
        description_cs: form.description_cs || null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        image_url: form.image_url || null,
        video_url: form.video_url || null,
        difficulty: (form.difficulty as Difficulty) || null,
        is_active: form.is_active,
      }

      let exerciseId: string
      if (editing) {
        const { error } = await supabase.from('exercises').update(payload).eq('id', editing.id)
        if (error) throw error
        exerciseId = editing.id
      } else {
        const { data, error } = await supabase.from('exercises').insert(payload).select('id').single()
        if (error) throw error
        exerciseId = data.id
      }

      // Replace muscles
      await supabase.from('exercise_muscles').delete().eq('exercise_id', exerciseId)
      const muscleRows = [
        ...primaryMuscles.map(id => ({ exercise_id: exerciseId, muscle_id: id, is_primary: true })),
        ...secondaryMuscles.map(id => ({ exercise_id: exerciseId, muscle_id: id, is_primary: false })),
      ]
      if (muscleRows.length > 0) {
        const { error } = await supabase.from('exercise_muscles').insert(muscleRows)
        if (error) throw error
      }

      // Replace equipment
      await supabase.from('exercise_equipment').delete().eq('exercise_id', exerciseId)
      const equipmentRows = selectedEquipment.map(id => ({ exercise_id: exerciseId, equipment_id: id }))
      if (equipmentRows.length > 0) {
        const { error } = await supabase.from('exercise_equipment').insert(equipmentRows)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises-admin'] })
      setEditorOpen(false)
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('exercises').update({ is_active: isActive }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises-admin'] }),
  })

  useEffect(() => {
    setActions(
      <Button variant="primary" onClick={openCreate}>+ Add Exercise</Button>
    )
    return () => setActions(null)
  }, [])

  function toggleMuscle(id: number, list: number[], setList: (v: number[]) => void) {
    setList(list.includes(id) ? list.filter(m => m !== id) : [...list, id])
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
        <select
          className="text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 text-[var(--text)]"
          value={filterCategory ?? ''}
          onChange={e => setFilterCategory(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name (EN)</Th>
              <Th>Category</Th>
              <Th>Difficulty</Th>
              <Th>Active</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {exercises.map(ex => (
              <tr key={ex.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    {ex.image_url && (
                      <img src={ex.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    )}
                    <span className="font-medium text-[var(--text)]">{ex.name_en}</span>
                  </div>
                </Td>
                <Td>{categories.find(c => c.id === ex.category_id)?.name ?? '—'}</Td>
                <Td>{ex.difficulty ?? '—'}</Td>
                <Td>
                  <button
                    onClick={() => toggleActive.mutate({ id: ex.id, isActive: !ex.is_active })}
                    className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer ${
                      ex.is_active
                        ? 'text-green-400 border-green-400/40 bg-green-400/10'
                        : 'text-[var(--text-disabled)] border-[var(--border)]'
                    }`}
                  >
                    {ex.is_active ? 'Active' : 'Hidden'}
                  </button>
                </Td>
                <Td>
                  <Button variant="ghost" onClick={() => openEdit(ex)}>Edit</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Editor Modal */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? 'Edit Exercise' : 'Add Exercise'}>
        <div className="flex flex-col gap-3 min-w-[520px] max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Name (EN) *</label>
              <Input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Name (CS)</label>
              <Input value={form.name_cs} onChange={e => setForm(f => ({ ...f, name_cs: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Description (EN)</label>
              <textarea
                className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text)] h-24 resize-none"
                value={form.description_en}
                onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Description (CS)</label>
              <textarea
                className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text)] h-24 resize-none"
                value={form.description_cs}
                onChange={e => setForm(f => ({ ...f, description_cs: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Category</label>
              <select
                className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text)]"
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Difficulty</label>
              <select
                className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text)]"
                value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
              >
                <option value="">None</option>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span className="text-sm text-[var(--text-muted)]">Active</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Image URL</label>
              <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest">Video URL</label>
              <Input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://…" />
            </div>
          </div>

          {/* Muscles */}
          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest block mb-1">Primary Muscles</label>
            <div className="flex flex-wrap gap-1">
              {muscles.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMuscle(m.id, primaryMuscles, setPrimaryMuscles)}
                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    primaryMuscles.includes(m.id)
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'text-[var(--text-muted)] border-[var(--border)]'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest block mb-1">Secondary Muscles</label>
            <div className="flex flex-wrap gap-1">
              {muscles.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMuscle(m.id, secondaryMuscles, setSecondaryMuscles)}
                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    secondaryMuscles.includes(m.id)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'text-[var(--text-muted)] border-[var(--border)]'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest block mb-1">Equipment</label>
            <div className="flex flex-wrap gap-1">
              {equipment.map(eq => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => toggleMuscle(eq.id, selectedEquipment, setSelectedEquipment)}
                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    selectedEquipment.includes(eq.id)
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'text-[var(--text-muted)] border-[var(--border)]'
                  }`}
                >
                  {eq.name}
                </button>
              ))}
            </div>
          </div>

          {saveExercise.error && (
            <p className="text-xs text-red-400">{String(saveExercise.error)}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => saveExercise.mutate()}
              disabled={!form.name_en || saveExercise.isPending}
            >
              {saveExercise.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Exercise'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 3: Add Exercises to Sidebar.tsx**

In `Sidebar.tsx`, add to `NAV_ITEMS` array after the Workouts entry:
```typescript
{ to: '/admin/exercises', label: 'Exercises', icon: '💪', end: false },
```

- [ ] **Step 4: Add Exercises route to App.tsx**

Add the import:
```typescript
import Exercises from './pages/admin/Exercises'
```

Add the route inside the `AdminLayout` routes:
```tsx
<Route path="/admin/exercises" element={<Exercises />} />
```

- [ ] **Step 5: Build admin panel**

```bash
cd admin && npm run build 2>&1 | tail -20
```

Expected: successful build, 0 TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add admin/src/types/database.ts
git add admin/src/pages/admin/Exercises.tsx
git add admin/src/components/Sidebar.tsx
git add admin/src/App.tsx
git commit -m "feat(admin): add Exercises tab with list, create/edit, and active toggle"
```

---

## Task 11: Import script

**Files:**
- Create: `scripts/import-exercises/package.json`
- Create: `scripts/import-exercises/import.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "import-exercises",
  "version": "1.0.0",
  "description": "One-time script to import exercises from wger.de into Supabase",
  "type": "module",
  "scripts": {
    "import": "node import.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create import.js**

```javascript
// scripts/import-exercises/import.js
// One-time import of exercises from wger.de into Supabase.
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node import.js
//
// Requires: npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js'

const WGER_BASE = 'https://wger.de/api/v2'
const ENGLISH_LANG = 2
const CZECH_LANG = 9
const PAGE_LIMIT = 100

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim()
}

async function wgerGet(path) {
  const res = await fetch(`${WGER_BASE}${path}`)
  if (!res.ok) throw new Error(`wger ${path} → ${res.status}`)
  return res.json()
}

async function wgerPaginate(path) {
  const results = []
  let url = `${WGER_BASE}${path}&limit=${PAGE_LIMIT}&offset=0`
  while (url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`wger paginate ${url} → ${res.status}`)
    const data = await res.json()
    results.push(...data.results)
    url = data.next
  }
  return results
}

async function downloadAndUpload(imageUrl, filename) {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const { data, error } = await supabase.storage
      .from('exercises')
      .upload(filename, buffer, { contentType: 'image/png', upsert: true })
    if (error) throw error
    const { data: publicData } = supabase.storage.from('exercises').getPublicUrl(filename)
    return publicData.publicUrl
  } catch (e) {
    console.warn(`  image download failed: ${imageUrl} — ${e.message}`)
    return null
  }
}

// ── Import steps ─────────────────────────────────────────────────────────────

async function importCategories() {
  console.log('Importing categories…')
  const data = await wgerGet('/exercisecategory/?format=json&limit=100')
  const rows = data.results.map(c => ({ id: c.id, name: c.name }))
  const { error } = await supabase.from('exercise_categories').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  console.log(`  ✓ ${rows.length} categories`)
  return rows
}

async function importMuscles() {
  console.log('Importing muscles…')
  const data = await wgerGet('/muscle/?format=json&limit=100')
  const rows = data.results.map(m => ({ id: m.id, name: m.name_en, is_front: m.is_front }))
  const { error } = await supabase.from('muscles').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  console.log(`  ✓ ${rows.length} muscles`)
}

async function importEquipment() {
  console.log('Importing equipment…')
  const data = await wgerGet('/equipment/?format=json&limit=100')
  const rows = data.results.map(e => ({ id: e.id, name: e.name }))
  const { error } = await supabase.from('equipment').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  console.log(`  ✓ ${rows.length} equipment types`)
}

async function importExercises() {
  console.log('Importing exercises (this takes a while)…')
  const all = await wgerPaginate(`/exerciseinfo/?format=json&language=${ENGLISH_LANG}`)
  console.log(`  Fetched ${all.length} exercises from wger`)

  let imported = 0
  let skipped = 0

  for (const ex of all) {
    const enTranslation = ex.translations?.find(t => t.language === ENGLISH_LANG)
    if (!enTranslation?.name) {
      console.warn(`  SKIP wger#${ex.id}: no English translation`)
      skipped++
      continue
    }
    const csTranslation = ex.translations?.find(t => t.language === CZECH_LANG)

    // Download main image
    let imageUrl = null
    const mainImage = ex.images?.find(img => img.is_main) ?? ex.images?.[0]
    if (mainImage?.image) {
      const ext = mainImage.image.split('.').pop() ?? 'png'
      const filename = `${ex.id}-${enTranslation.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.${ext}`
      imageUrl = await downloadAndUpload(mainImage.image, filename)
    }

    // Insert exercise
    const { data: exerciseRow, error: exError } = await supabase
      .from('exercises')
      .upsert({
        name_en: enTranslation.name,
        description_en: stripHtml(enTranslation.description ?? ''),
        name_cs: csTranslation?.name ?? null,
        description_cs: csTranslation?.description ? stripHtml(csTranslation.description) : null,
        category_id: ex.category?.id ?? null,
        image_url: imageUrl,
        video_url: ex.videos?.[0]?.video ?? null,
        wger_id: ex.id,
        is_active: true,
      }, { onConflict: 'wger_id' })
      .select('id')
      .single()

    if (exError) {
      console.warn(`  ERROR wger#${ex.id}: ${exError.message}`)
      skipped++
      continue
    }

    const exerciseId = exerciseRow.id

    // Insert muscles
    if (ex.muscles?.length > 0 || ex.muscles_secondary?.length > 0) {
      const muscleRows = [
        ...(ex.muscles ?? []).map(m => ({ exercise_id: exerciseId, muscle_id: m.id, is_primary: true })),
        ...(ex.muscles_secondary ?? []).map(m => ({ exercise_id: exerciseId, muscle_id: m.id, is_primary: false })),
      ]
      await supabase.from('exercise_muscles').upsert(muscleRows, { onConflict: 'exercise_id,muscle_id,is_primary' })
    }

    // Insert equipment
    if (ex.equipment?.length > 0) {
      const eqRows = ex.equipment.map(e => ({ exercise_id: exerciseId, equipment_id: e.id }))
      await supabase.from('exercise_equipment').upsert(eqRows, { onConflict: 'exercise_id,equipment_id' })
    }

    imported++
    if (imported % 50 === 0) console.log(`  … ${imported} imported so far`)
  }

  console.log(`  ✓ ${imported} exercises imported, ${skipped} skipped`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
    process.exit(1)
  }

  await importCategories()
  await importMuscles()
  await importEquipment()
  await importExercises()
  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: Install dependencies and run a dry-run check**

```bash
cd scripts/import-exercises && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Commit the script**

```bash
git add scripts/import-exercises/
git commit -m "chore(scripts): add one-time wger→Supabase exercise import script"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
./gradlew :composeApp:testDebugUnitTest
```

Expected: all tests pass.

- [ ] **Step 2: Build the KMP app**

```bash
./gradlew :composeApp:assembleDebug
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Build the admin panel**

```bash
cd admin && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete exercises migration from wger to Supabase"
```
