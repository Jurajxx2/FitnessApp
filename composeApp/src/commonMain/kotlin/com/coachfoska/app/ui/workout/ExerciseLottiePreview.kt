package com.coachfoska.app.ui.workout

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import com.coachfoska.app.domain.model.ExerciseLottieAnimation
import com.coachfoska.app.domain.model.ExerciseLottieVariant
import io.github.alexzhirkevich.compottie.Compottie
import io.github.alexzhirkevich.compottie.LottieCompositionSpec
import io.github.alexzhirkevich.compottie.rememberLottieComposition
import io.github.alexzhirkevich.compottie.rememberLottiePainter
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import org.koin.compose.koinInject

/**
 * Small Lottie previews for active workouts. Database-resident payloads take precedence, then
 * Storage URLs, then the local generated fallback catalog.
 */
enum class ExerciseFigureVariant { Neutral, Woman, Man }

@Composable
fun ExerciseLottiePreview(
    exerciseName: String,
    animationJson: String? = null,
    animationUrl: String? = null,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
    figureVariant: ExerciseFigureVariant = ExerciseFigureVariant.Neutral,
    httpClient: HttpClient = koinInject(),
) {
    val fallbackAnimationJson = remember(exerciseName, figureVariant) {
        ExerciseLottieCatalog.jsonFor(exerciseName, figureVariant)
    }
    val remoteAnimationJson by produceState<String?>(initialValue = null, animationUrl, animationJson) {
        value = animationUrl?.takeIf { animationJson.isNullOrBlank() }?.let { url ->
            runCatching {
                httpClient.get(url)
                    .takeIf { it.status.isSuccess() }
                    ?.bodyAsText()
            }.getOrNull()
        }
    }
    val resolvedAnimationJson = animationJson?.takeIf { it.isNotBlank() }
        ?: remoteAnimationJson
        ?: fallbackAnimationJson
        ?: return
    val composition by rememberLottieComposition {
        LottieCompositionSpec.JsonString(resolvedAnimationJson)
    }

    composition?.let {
        Image(
            painter = rememberLottiePainter(
                composition = it,
                iterations = Compottie.IterateForever,
            ),
            contentDescription = contentDescription,
            contentScale = ContentScale.Fit,
            modifier = modifier,
        )
    }
}

fun hasExerciseLottiePreview(exerciseName: String): Boolean =
    ExerciseLottieCatalog.hasPreview(exerciseName)

fun List<ExerciseLottieAnimation>.lottieJsonFor(figureVariant: ExerciseFigureVariant): String? {
    val preferredVariant = when (figureVariant) {
        ExerciseFigureVariant.Woman -> ExerciseLottieVariant.WOMAN
        ExerciseFigureVariant.Neutral,
        ExerciseFigureVariant.Man,
        -> ExerciseLottieVariant.MAN
    }
    return firstOrNull { it.variant == preferredVariant }?.lottieJson
        ?: firstOrNull { it.variant == ExerciseLottieVariant.MAN }?.lottieJson
        ?: firstOrNull()?.lottieJson
}

internal object ExerciseLottieCatalog {
    private const val Width = 160
    private const val Height = 160
    private const val EndFrame = 60

    private enum class ExerciseAnimation(val label: String) {
        Squat("Barbell Back Squat"),
        PushUp("Push-Up"),
        BenchPress("Barbell Bench Press"),
        Deadlift("Barbell Deadlift"),
        PullUp("Pull-Up"),
        OverheadPress("Overhead Press"),
        Row("Bent-Over Row"),
        Lunge("Dumbbell Lunge"),
        Plank("Plank"),
        Crunch("Crunch"),
        BicepCurl("Dumbbell Bicep Curl"),
        TricepsPushdown("Triceps Pushdown"),
        LateralRaise("Dumbbell Lateral Raise"),
        FrontRaise("Dumbbell Front Raise"),
        LegPress("Leg Press"),
        HipThrust("Barbell Hip Thrust"),
        RomanianDeadlift("Romanian Deadlift"),
        CalfRaise("Standing Calf Raise"),
        LegExtension("Leg Extension"),
        LegCurl("Leg Curl"),
        LatPulldown("Lat Pulldown"),
        CableFly("Cable Chest Fly"),
        Dip("Dip"),
        Burpee("Burpee"),
        MountainClimber("Mountain Climber"),
        RussianTwist("Russian Twist"),
        HangingLegRaise("Hanging Leg Raise"),
        KettlebellSwing("Kettlebell Swing"),
        GobletSquat("Goblet Squat"),
        StepUp("Step-Up"),
    }

    private enum class PrimitiveType { Rectangle, Ellipse }

    private data class Point(val x: Int, val y: Int)

    private data class Color(val r: Float, val g: Float, val b: Float)

    private data class Primitive(
        val name: String,
        val type: PrimitiveType,
        val width: Int,
        val height: Int,
        val from: Point,
        val to: Point = from,
        val color: Color,
        val radius: Int = 4,
        val rotationFrom: Int = 0,
        val rotationTo: Int = rotationFrom,
    )

    private val ink = Color(0.12f, 0.17f, 0.23f)
    private val accent = Color(0.26f, 0.78f, 0.64f)
    private val muted = Color(0.56f, 0.64f, 0.71f)
    private val bar = Color(0.29f, 0.35f, 0.42f)
    private val ground = Color(0.82f, 0.86f, 0.90f)

    private fun resolve(exerciseName: String): ExerciseAnimation? {
        val name = exerciseName.lowercase()
        return when {
            "bench press" in name -> ExerciseAnimation.BenchPress
            "deadlift" in name -> ExerciseAnimation.Deadlift
            "pull-up" in name || "pull up" in name || "pullup" in name ||
                "chin-up" in name || "chin up" in name || "chinup" in name -> ExerciseAnimation.PullUp
            "lat pulldown" in name -> ExerciseAnimation.LatPulldown
            "overhead press" in name || "shoulder press" in name || "military press" in name -> ExerciseAnimation.OverheadPress
            "push-up" in name || "push up" in name || "pushup" in name -> ExerciseAnimation.PushUp
            "goblet squat" in name -> ExerciseAnimation.GobletSquat
            "squat" in name -> ExerciseAnimation.Squat
            "romanian deadlift" in name || "rdl" in name -> ExerciseAnimation.RomanianDeadlift
            "kettlebell swing" in name -> ExerciseAnimation.KettlebellSwing
            "hip thrust" in name || "glute bridge" in name -> ExerciseAnimation.HipThrust
            "leg press" in name -> ExerciseAnimation.LegPress
            "leg extension" in name -> ExerciseAnimation.LegExtension
            "leg curl" in name || "hamstring curl" in name -> ExerciseAnimation.LegCurl
            "calf raise" in name -> ExerciseAnimation.CalfRaise
            "bicep" in name || "biceps" in name || "curl" in name -> ExerciseAnimation.BicepCurl
            "tricep" in name || "triceps" in name || "pushdown" in name -> ExerciseAnimation.TricepsPushdown
            "lateral raise" in name || "side raise" in name -> ExerciseAnimation.LateralRaise
            "front raise" in name -> ExerciseAnimation.FrontRaise
            "cable fly" in name || "chest fly" in name || "pec deck" in name -> ExerciseAnimation.CableFly
            "dip" in name -> ExerciseAnimation.Dip
            "burpee" in name -> ExerciseAnimation.Burpee
            "mountain climber" in name -> ExerciseAnimation.MountainClimber
            "russian twist" in name -> ExerciseAnimation.RussianTwist
            "hanging leg raise" in name || "hanging knee raise" in name -> ExerciseAnimation.HangingLegRaise
            "step-up" in name || "step up" in name -> ExerciseAnimation.StepUp
            "row" in name -> ExerciseAnimation.Row
            "lunge" in name -> ExerciseAnimation.Lunge
            "plank" in name -> ExerciseAnimation.Plank
            "crunch" in name || "sit-up" in name || "sit up" in name || "situp" in name -> ExerciseAnimation.Crunch
            else -> null
        }
    }

    fun hasPreview(exerciseName: String): Boolean = resolve(exerciseName) != null

    fun jsonFor(
        exerciseName: String,
        figureVariant: ExerciseFigureVariant = ExerciseFigureVariant.Neutral,
    ): String? = resolve(exerciseName)?.let { animation(it, figureVariant) }

    private fun animation(exercise: ExerciseAnimation, figureVariant: ExerciseFigureVariant): String {
        val layers = stylize(when (exercise) {
            ExerciseAnimation.Squat -> squat()
            ExerciseAnimation.PushUp -> pushUp()
            ExerciseAnimation.BenchPress -> benchPress()
            ExerciseAnimation.Deadlift -> deadlift()
            ExerciseAnimation.PullUp -> pullUp()
            ExerciseAnimation.OverheadPress -> overheadPress()
            ExerciseAnimation.Row -> row()
            ExerciseAnimation.Lunge -> lunge()
            ExerciseAnimation.Plank -> plank()
            ExerciseAnimation.Crunch -> crunch()
            ExerciseAnimation.BicepCurl -> bicepCurl()
            ExerciseAnimation.TricepsPushdown -> tricepsPushdown()
            ExerciseAnimation.LateralRaise -> lateralRaise()
            ExerciseAnimation.FrontRaise -> frontRaise()
            ExerciseAnimation.LegPress -> legPress()
            ExerciseAnimation.HipThrust -> hipThrust()
            ExerciseAnimation.RomanianDeadlift -> romanianDeadlift()
            ExerciseAnimation.CalfRaise -> calfRaise()
            ExerciseAnimation.LegExtension -> legExtension()
            ExerciseAnimation.LegCurl -> legCurl()
            ExerciseAnimation.LatPulldown -> latPulldown()
            ExerciseAnimation.CableFly -> cableFly()
            ExerciseAnimation.Dip -> dip()
            ExerciseAnimation.Burpee -> burpee()
            ExerciseAnimation.MountainClimber -> mountainClimber()
            ExerciseAnimation.RussianTwist -> russianTwist()
            ExerciseAnimation.HangingLegRaise -> hangingLegRaise()
            ExerciseAnimation.KettlebellSwing -> kettlebellSwing()
            ExerciseAnimation.GobletSquat -> gobletSquat()
            ExerciseAnimation.StepUp -> stepUp()
        }, figureVariant)
        return buildString {
            append("{\"v\":\"5.9.0\",\"fr\":30,\"ip\":0,\"op\":$EndFrame,\"w\":$Width,\"h\":$Height,")
            append("\"nm\":\"")
            append(exercise.label)
            append("\",\"ddd\":0,\"assets\":[],\"layers\":[")
            layers.forEachIndexed { index, primitive ->
                if (index > 0) append(',')
                append(layer(index + 1, primitive))
            }
            append("]}")
        }
    }

    private fun layer(index: Int, primitive: Primitive): String {
        val shape = when (primitive.type) {
            PrimitiveType.Rectangle -> "{\"ty\":\"rc\",\"nm\":\"${primitive.name}\",\"d\":1,\"s\":{\"a\":0,\"k\":[${primitive.width},${primitive.height}]},\"p\":{\"a\":0,\"k\":[0,0]},\"r\":{\"a\":0,\"k\":${primitive.radius}}}"
            PrimitiveType.Ellipse -> "{\"ty\":\"el\",\"nm\":\"${primitive.name}\",\"d\":1,\"s\":{\"a\":0,\"k\":[${primitive.width},${primitive.height}]},\"p\":{\"a\":0,\"k\":[0,0]}}"
        }
        return "{\"ddd\":0,\"ind\":$index,\"ty\":4,\"nm\":\"${primitive.name}\",\"sr\":1," +
            "\"ks\":{\"o\":{\"a\":0,\"k\":100},\"r\":${numberProperty(primitive.rotationFrom, primitive.rotationTo)}," +
            "\"p\":${vectorProperty(primitive.from, primitive.to)},\"a\":{\"a\":0,\"k\":[0,0]},\"s\":{\"a\":0,\"k\":[100,100]}}," +
            "\"ao\":0,\"shapes\":[$shape,{\"ty\":\"fl\",\"c\":{\"a\":0,\"k\":[${primitive.color.r},${primitive.color.g},${primitive.color.b},1]},\"o\":{\"a\":0,\"k\":100},\"r\":1,\"bm\":0},{\"ty\":\"tr\",\"p\":{\"a\":0,\"k\":[0,0]},\"a\":{\"a\":0,\"k\":[0,0]},\"s\":{\"a\":0,\"k\":[100,100]},\"r\":{\"a\":0,\"k\":0},\"o\":{\"a\":0,\"k\":100}}]," +
            "\"ip\":0,\"op\":$EndFrame,\"st\":0,\"bm\":0}"
    }

    private fun vectorProperty(from: Point, to: Point): String =
        if (from == to) "{\"a\":0,\"k\":[${from.x},${from.y}]}"
        else animatedProperty("[${from.x},${from.y}]", "[${to.x},${to.y}]")

    private fun numberProperty(from: Int, to: Int): String =
        if (from == to) "{\"a\":0,\"k\":$from}"
        else animatedProperty(from.toString(), to.toString())

    private fun animatedProperty(from: String, to: String): String =
        "{\"a\":1,\"k\":[" +
            "{\"i\":{\"x\":[0.42],\"y\":[1]},\"o\":{\"x\":[0.58],\"y\":[0]},\"t\":0,\"s\":$from,\"e\":$to}," +
            "{\"i\":{\"x\":[0.42],\"y\":[1]},\"o\":{\"x\":[0.58],\"y\":[0]},\"t\":30,\"s\":$to,\"e\":$from}," +
            "{\"t\":60,\"s\":$from}]}"

    private fun stylize(
        primitives: List<Primitive>,
        figureVariant: ExerciseFigureVariant,
    ): List<Primitive> {
        val body = primitives.map { primitive ->
            if (primitive.name == "Torso" || primitive.name == "Body") {
                when (figureVariant) {
                    ExerciseFigureVariant.Neutral -> primitive
                    ExerciseFigureVariant.Woman -> primitive.copy(width = (primitive.width * 0.86f).toInt())
                    ExerciseFigureVariant.Man -> primitive.copy(width = (primitive.width * 1.16f).toInt())
                }
            } else {
                primitive
            }
        }
        if (figureVariant != ExerciseFigureVariant.Woman) return body

        val head = primitives.firstOrNull { it.name == "Head" } ?: return body
        val hair = Primitive(
            name = "Hair",
            type = PrimitiveType.Ellipse,
            width = 21,
            height = 10,
            from = Point(head.from.x, head.from.y - 5),
            to = Point(head.to.x, head.to.y - 5),
            color = bar,
        )
        return listOf(hair) + body
    }

    private fun rect(
        name: String,
        x: Int,
        y: Int,
        width: Int,
        height: Int,
        color: Color,
        toX: Int = x,
        toY: Int = y,
        rotationFrom: Int = 0,
        rotationTo: Int = rotationFrom,
        radius: Int = 5,
    ) = Primitive(name, PrimitiveType.Rectangle, width, height, Point(x, y), Point(toX, toY), color, radius, rotationFrom, rotationTo)

    private fun head(name: String, x: Int, y: Int, toX: Int = x, toY: Int = y) =
        Primitive(name, PrimitiveType.Ellipse, 18, 18, Point(x, y), Point(toX, toY), accent)

    private fun floor() = rect("Ground", 80, 141, 112, 3, ground, radius = 2)

    private fun barbell(y: Int, toY: Int = y) = listOf(
        rect("Plate left", 38, y, 8, 24, ink, toY = toY, radius = 3),
        rect("Plate right", 122, y, 8, 24, ink, toY = toY, radius = 3),
        rect("Barbell", 80, y, 92, 5, bar, toY = toY, radius = 3),
    )

    private fun squat() = buildList {
        addAll(barbell(44, 66))
        add(head("Head", 80, 58, toY = 80))
        add(rect("Torso", 80, 79, 18, 37, ink, toY = 101, radius = 7))
        add(rect("Left thigh", 67, 105, 11, 41, ink, rotationFrom = 18, rotationTo = 66))
        add(rect("Right thigh", 93, 105, 11, 41, ink, rotationFrom = -18, rotationTo = -66))
        add(rect("Left shin", 60, 128, 10, 35, muted, rotationFrom = -10, rotationTo = -40))
        add(rect("Right shin", 100, 128, 10, 35, muted, rotationFrom = 10, rotationTo = 40))
        add(floor())
    }

    private fun pushUp() = buildList {
        add(head("Head", 44, 75, toY = 94))
        add(rect("Body", 82, 82, 69, 16, ink, toY = 101, rotationFrom = -7, rotationTo = -7, radius = 8))
        add(rect("Front arm", 63, 110, 10, 39, accent, rotationFrom = 23, rotationTo = 53))
        add(rect("Back arm", 84, 113, 10, 37, accent, rotationFrom = -15, rotationTo = -43))
        add(rect("Left leg", 119, 111, 11, 44, muted, rotationFrom = -20, rotationTo = -10))
        add(rect("Right leg", 129, 109, 11, 43, muted, rotationFrom = -25, rotationTo = -15))
        add(floor())
    }

    private fun benchPress() = buildList {
        addAll(barbell(49, 76))
        add(head("Head", 43, 94))
        add(rect("Torso", 74, 98, 58, 17, ink, radius = 8))
        add(rect("Left arm", 69, 72, 10, 39, accent, rotationFrom = 0, rotationTo = 0))
        add(rect("Right arm", 92, 72, 10, 39, accent, rotationFrom = 0, rotationTo = 0))
        add(rect("Bench", 80, 111, 92, 13, bar, radius = 5))
        add(rect("Bench left leg", 52, 130, 6, 33, bar, rotationFrom = 14, radius = 3))
        add(rect("Bench right leg", 108, 130, 6, 33, bar, rotationFrom = -14, radius = 3))
        add(floor())
    }

    private fun deadlift() = buildList {
        addAll(barbell(126, 91))
        add(head("Head", 72, 56, toX = 79, toY = 36))
        add(rect("Torso", 80, 82, 19, 45, ink, rotationFrom = 32, rotationTo = 0, radius = 7))
        add(rect("Left arm", 66, 99, 9, 40, accent, rotationFrom = 27, rotationTo = 8))
        add(rect("Right arm", 89, 102, 9, 42, accent, rotationFrom = -19, rotationTo = -8))
        add(rect("Left leg", 69, 119, 12, 43, muted, rotationFrom = 15, rotationTo = 0))
        add(rect("Right leg", 91, 119, 12, 43, muted, rotationFrom = -15, rotationTo = 0))
        add(floor())
    }

    private fun pullUp() = buildList {
        add(head("Head", 80, 78, toY = 48))
        add(rect("Torso", 80, 106, 18, 38, ink, toY = 76, radius = 7))
        add(rect("Left arm", 63, 65, 9, 41, accent, toY = 40, rotationFrom = 24))
        add(rect("Right arm", 97, 65, 9, 41, accent, toY = 40, rotationFrom = -24))
        add(rect("Left leg", 72, 137, 11, 45, muted, toY = 107, rotationFrom = 18))
        add(rect("Right leg", 88, 137, 11, 45, muted, toY = 107, rotationFrom = -18))
        add(rect("Pull-up bar", 80, 26, 104, 7, bar, radius = 4))
        add(floor())
    }

    private fun overheadPress() = buildList {
        addAll(barbell(70, 29))
        add(head("Head", 80, 57))
        add(rect("Torso", 80, 87, 20, 42, ink, radius = 7))
        add(rect("Left arm", 64, 79, 10, 40, accent, rotationFrom = 23, rotationTo = 2))
        add(rect("Right arm", 96, 79, 10, 40, accent, rotationFrom = -23, rotationTo = -2))
        add(rect("Left leg", 71, 122, 11, 40, muted, rotationFrom = 8))
        add(rect("Right leg", 89, 122, 11, 40, muted, rotationFrom = -8))
        add(floor())
    }

    private fun row() = buildList {
        addAll(barbell(117, 94))
        add(head("Head", 60, 59))
        add(rect("Torso", 81, 81, 19, 57, ink, rotationFrom = 57, radius = 7))
        add(rect("Left arm", 76, 96, 9, 41, accent, rotationFrom = 38, rotationTo = 56))
        add(rect("Right arm", 91, 101, 9, 39, accent, rotationFrom = -28, rotationTo = -48))
        add(rect("Left leg", 73, 118, 11, 43, muted, rotationFrom = 12))
        add(rect("Right leg", 95, 118, 11, 43, muted, rotationFrom = -14))
        add(floor())
    }

    private fun lunge() = buildList {
        add(head("Head", 78, 46, toX = 65, toY = 64))
        add(rect("Torso", 78, 75, 20, 42, ink, toX = 65, toY = 93, radius = 7))
        add(rect("Left arm", 58, 82, 10, 39, accent, toX = 45, toY = 100, rotationFrom = 8))
        add(rect("Right arm", 98, 82, 10, 39, accent, toX = 85, toY = 100, rotationFrom = -8))
        add(rect("Left dumbbell", 55, 108, 23, 8, bar, toX = 42, toY = 126, radius = 3))
        add(rect("Right dumbbell", 101, 108, 23, 8, bar, toX = 88, toY = 126, radius = 3))
        add(rect("Front leg", 61, 117, 13, 49, muted, rotationFrom = 30, rotationTo = 55))
        add(rect("Back leg", 96, 117, 13, 49, muted, rotationFrom = -18, rotationTo = -44))
        add(floor())
    }

    private fun plank() = buildList {
        add(head("Head", 42, 88, toY = 94))
        add(rect("Body", 85, 91, 77, 17, ink, toY = 97, rotationFrom = -5, radius = 8))
        add(rect("Left forearm", 61, 115, 10, 38, accent, rotationFrom = 8, rotationTo = 15))
        add(rect("Right forearm", 72, 116, 10, 38, accent, rotationFrom = -8, rotationTo = -15))
        add(rect("Left leg", 121, 112, 11, 46, muted, rotationFrom = -18))
        add(rect("Right leg", 132, 109, 11, 45, muted, rotationFrom = -23))
        add(floor())
    }

    private fun crunch() = buildList {
        add(head("Head", 43, 70, toX = 56, toY = 49))
        add(rect("Torso", 65, 93, 18, 54, ink, rotationFrom = 55, rotationTo = 24, radius = 7))
        add(rect("Left arm", 52, 76, 9, 37, accent, toX = 61, toY = 59, rotationFrom = -12))
        add(rect("Right arm", 72, 92, 9, 36, accent, toX = 77, toY = 72, rotationFrom = 32))
        add(rect("Hip", 85, 115, 14, 14, ink, radius = 7))
        add(rect("Left thigh", 106, 106, 12, 44, muted, rotationFrom = 48))
        add(rect("Left shin", 124, 126, 11, 39, muted, rotationFrom = -12))
        add(rect("Right thigh", 111, 112, 11, 42, muted, rotationFrom = 40))
        add(rect("Mat", 80, 132, 112, 13, ground, radius = 6))
    }

    private fun bicepCurl() = buildList {
        add(head("Head", 80, 45))
        add(rect("Torso", 80, 75, 20, 42, ink, radius = 7))
        add(rect("Left arm", 59, 82, 10, 42, accent, rotationFrom = 10, rotationTo = 66))
        add(rect("Right arm", 101, 82, 10, 42, accent, rotationFrom = -10, rotationTo = -66))
        add(rect("Left dumbbell", 55, 107, 24, 8, bar, toX = 65, toY = 72, rotationFrom = 10, rotationTo = 66, radius = 3))
        add(rect("Right dumbbell", 105, 107, 24, 8, bar, toX = 95, toY = 72, rotationFrom = -10, rotationTo = -66, radius = 3))
        add(rect("Left leg", 71, 121, 11, 40, muted, rotationFrom = 8))
        add(rect("Right leg", 89, 121, 11, 40, muted, rotationFrom = -8))
        add(floor())
    }

    private fun tricepsPushdown() = buildList {
        add(head("Head", 82, 48))
        add(rect("Torso", 82, 78, 20, 42, ink, radius = 7))
        add(rect("Cable", 80, 30, 3, 64, bar, radius = 1))
        add(rect("Handle", 80, 74, 36, 6, bar, toY = 105, radius = 3))
        add(rect("Left arm", 66, 82, 9, 39, accent, rotationFrom = 32, rotationTo = 3))
        add(rect("Right arm", 98, 82, 9, 39, accent, rotationFrom = -32, rotationTo = -3))
        add(rect("Left leg", 73, 122, 11, 39, muted, rotationFrom = 8))
        add(rect("Right leg", 91, 122, 11, 39, muted, rotationFrom = -8))
        add(floor())
    }

    private fun lateralRaise() = buildList {
        add(head("Head", 80, 46))
        add(rect("Torso", 80, 76, 20, 42, ink, radius = 7))
        add(rect("Left arm", 57, 79, 10, 43, accent, rotationFrom = 8, rotationTo = -82))
        add(rect("Right arm", 103, 79, 10, 43, accent, rotationFrom = -8, rotationTo = 82))
        add(rect("Left dumbbell", 53, 108, 23, 8, bar, toX = 40, toY = 66, rotationFrom = 8, rotationTo = -82, radius = 3))
        add(rect("Right dumbbell", 107, 108, 23, 8, bar, toX = 120, toY = 66, rotationFrom = -8, rotationTo = 82, radius = 3))
        add(rect("Left leg", 71, 122, 11, 40, muted, rotationFrom = 8))
        add(rect("Right leg", 89, 122, 11, 40, muted, rotationFrom = -8))
        add(floor())
    }

    private fun frontRaise() = buildList {
        add(head("Head", 80, 46))
        add(rect("Torso", 80, 76, 20, 42, ink, radius = 7))
        add(rect("Left arm", 66, 80, 10, 43, accent, rotationFrom = 18, rotationTo = -70))
        add(rect("Right arm", 94, 80, 10, 43, accent, rotationFrom = -18, rotationTo = 70))
        add(rect("Left dumbbell", 61, 108, 23, 8, bar, toX = 61, toY = 61, rotationFrom = 18, rotationTo = -70, radius = 3))
        add(rect("Right dumbbell", 99, 108, 23, 8, bar, toX = 99, toY = 61, rotationFrom = -18, rotationTo = 70, radius = 3))
        add(rect("Left leg", 71, 122, 11, 40, muted, rotationFrom = 8))
        add(rect("Right leg", 89, 122, 11, 40, muted, rotationFrom = -8))
        add(floor())
    }

    private fun legPress() = buildList {
        add(rect("Machine frame", 117, 57, 8, 118, bar, rotationFrom = -24, radius = 3))
        add(rect("Foot plate", 120, 54, 45, 10, bar, rotationFrom = -24, radius = 3))
        add(head("Head", 49, 87))
        add(rect("Seat", 65, 111, 54, 15, bar, rotationFrom = -24, radius = 5))
        add(rect("Torso", 63, 92, 20, 42, ink, rotationFrom = -24, radius = 7))
        add(rect("Left thigh", 85, 108, 11, 42, muted, rotationFrom = 40, rotationTo = 15))
        add(rect("Right thigh", 92, 113, 11, 42, muted, rotationFrom = 32, rotationTo = 8))
        add(rect("Left shin", 105, 83, 10, 40, muted, rotationFrom = -30, rotationTo = -15))
        add(rect("Right shin", 111, 88, 10, 40, muted, rotationFrom = -36, rotationTo = -20))
        add(floor())
    }

    private fun hipThrust() = buildList {
        addAll(barbell(93, 70))
        add(head("Head", 46, 96, toY = 70))
        add(rect("Torso", 71, 101, 55, 18, ink, toY = 75, rotationFrom = -8, rotationTo = -2, radius = 8))
        add(rect("Left thigh", 99, 112, 12, 44, muted, rotationFrom = 35, rotationTo = 12))
        add(rect("Right thigh", 108, 116, 12, 43, muted, rotationFrom = 30, rotationTo = 8))
        add(rect("Left shin", 122, 128, 11, 35, muted, rotationFrom = 4))
        add(rect("Right shin", 132, 128, 11, 35, muted, rotationFrom = -4))
        add(rect("Bench", 38, 116, 42, 16, bar, radius = 5))
        add(floor())
    }

    private fun romanianDeadlift() = buildList {
        addAll(barbell(122, 103))
        add(head("Head", 66, 55, toX = 75, toY = 43))
        add(rect("Torso", 79, 82, 19, 52, ink, rotationFrom = 48, rotationTo = 20, radius = 7))
        add(rect("Left arm", 71, 101, 9, 42, accent, rotationFrom = 34, rotationTo = 18))
        add(rect("Right arm", 89, 104, 9, 42, accent, rotationFrom = -28, rotationTo = -15))
        add(rect("Left leg", 72, 120, 12, 43, muted, rotationFrom = 12, rotationTo = 3))
        add(rect("Right leg", 93, 120, 12, 43, muted, rotationFrom = -12, rotationTo = -3))
        add(floor())
    }

    private fun calfRaise() = buildList {
        add(head("Head", 80, 52, toY = 42))
        add(rect("Torso", 80, 82, 20, 42, ink, toY = 72, radius = 7))
        add(rect("Left arm", 61, 88, 10, 41, accent, toY = 78, rotationFrom = 8))
        add(rect("Right arm", 99, 88, 10, 41, accent, toY = 78, rotationFrom = -8))
        add(rect("Left leg", 71, 121, 11, 41, muted, toY = 111, rotationFrom = 8))
        add(rect("Right leg", 89, 121, 11, 41, muted, toY = 111, rotationFrom = -8))
        add(rect("Step", 80, 139, 72, 8, bar, radius = 3))
        add(floor())
    }

    private fun legExtension() = buildList {
        add(head("Head", 52, 64))
        add(rect("Torso", 63, 86, 20, 43, ink, rotationFrom = -20, radius = 7))
        add(rect("Seat", 74, 111, 57, 15, bar, radius = 5))
        add(rect("Backrest", 43, 89, 12, 53, bar, rotationFrom = -20, radius = 4))
        add(rect("Left thigh", 86, 111, 12, 42, muted, rotationFrom = 58, rotationTo = 15))
        add(rect("Right thigh", 94, 116, 12, 41, muted, rotationFrom = 50, rotationTo = 10))
        add(rect("Left shin", 113, 122, 11, 43, muted, rotationFrom = 0, rotationTo = -75))
        add(rect("Right shin", 119, 125, 11, 41, muted, rotationFrom = 0, rotationTo = -70))
        add(rect("Pad", 128, 123, 25, 9, bar, toY = 97, rotationFrom = 0, rotationTo = -75, radius = 3))
        add(floor())
    }

    private fun legCurl() = buildList {
        add(head("Head", 44, 91))
        add(rect("Torso", 75, 97, 63, 18, ink, rotationFrom = -5, radius = 8))
        add(rect("Bench", 80, 113, 91, 14, bar, radius = 5))
        add(rect("Left leg", 112, 111, 11, 47, muted, rotationFrom = -20, rotationTo = -72))
        add(rect("Right leg", 124, 108, 11, 46, muted, rotationFrom = -25, rotationTo = -77))
        add(rect("Left pad", 121, 132, 23, 9, bar, toX = 105, toY = 109, rotationFrom = -20, rotationTo = -72, radius = 3))
        add(rect("Right pad", 132, 128, 23, 9, bar, toX = 115, toY = 105, rotationFrom = -25, rotationTo = -77, radius = 3))
        add(floor())
    }

    private fun latPulldown() = buildList {
        addAll(barbell(35, 64))
        add(rect("Cable", 80, 26, 3, 76, bar, radius = 1))
        add(head("Head", 80, 75))
        add(rect("Torso", 80, 103, 20, 40, ink, radius = 7))
        add(rect("Left arm", 62, 67, 10, 43, accent, rotationFrom = 20, rotationTo = 48))
        add(rect("Right arm", 98, 67, 10, 43, accent, rotationFrom = -20, rotationTo = -48))
        add(rect("Seat", 80, 129, 56, 14, bar, radius = 5))
        add(rect("Left leg", 70, 137, 11, 32, muted, rotationFrom = 8))
        add(rect("Right leg", 90, 137, 11, 32, muted, rotationFrom = -8))
        add(floor())
    }

    private fun cableFly() = buildList {
        add(rect("Left cable", 26, 52, 3, 80, bar, rotationFrom = -18, radius = 1))
        add(rect("Right cable", 134, 52, 3, 80, bar, rotationFrom = 18, radius = 1))
        add(head("Head", 80, 45))
        add(rect("Torso", 80, 76, 20, 42, ink, radius = 7))
        add(rect("Left arm", 56, 78, 10, 45, accent, rotationFrom = -72, rotationTo = -25))
        add(rect("Right arm", 104, 78, 10, 45, accent, rotationFrom = 72, rotationTo = 25))
        add(rect("Left handle", 42, 66, 22, 7, bar, toX = 70, toY = 82, rotationFrom = -20, rotationTo = 0, radius = 3))
        add(rect("Right handle", 118, 66, 22, 7, bar, toX = 90, toY = 82, rotationFrom = 20, rotationTo = 0, radius = 3))
        add(rect("Left leg", 71, 122, 11, 40, muted, rotationFrom = 8))
        add(rect("Right leg", 89, 122, 11, 40, muted, rotationFrom = -8))
        add(floor())
    }

    private fun dip() = buildList {
        add(head("Head", 80, 64, toY = 82))
        add(rect("Torso", 80, 94, 20, 41, ink, toY = 112, radius = 7))
        add(rect("Left arm", 61, 91, 10, 39, accent, toY = 109, rotationFrom = 25, rotationTo = 48))
        add(rect("Right arm", 99, 91, 10, 39, accent, toY = 109, rotationFrom = -25, rotationTo = -48))
        add(rect("Left leg", 71, 126, 11, 43, muted, toY = 140, rotationFrom = 18))
        add(rect("Right leg", 89, 126, 11, 43, muted, toY = 140, rotationFrom = -18))
        add(rect("Left dip bar", 50, 100, 7, 78, bar, radius = 3))
        add(rect("Right dip bar", 110, 100, 7, 78, bar, radius = 3))
        add(floor())
    }

    private fun burpee() = buildList {
        add(head("Head", 55, 51, toX = 43, toY = 96))
        add(rect("Torso", 72, 78, 20, 43, ink, toX = 81, toY = 103, rotationFrom = 16, rotationTo = -8, radius = 7))
        add(rect("Left arm", 57, 85, 10, 41, accent, toX = 62, toY = 116, rotationFrom = 20, rotationTo = 52))
        add(rect("Right arm", 86, 85, 10, 41, accent, toX = 83, toY = 117, rotationFrom = -16, rotationTo = -48))
        add(rect("Left leg", 63, 113, 12, 45, muted, toX = 116, toY = 116, rotationFrom = 18, rotationTo = -36))
        add(rect("Right leg", 85, 113, 12, 45, muted, toX = 128, toY = 112, rotationFrom = -18, rotationTo = -42))
        add(floor())
    }

    private fun mountainClimber() = buildList {
        add(head("Head", 43, 88, toY = 94))
        add(rect("Body", 83, 91, 77, 17, ink, toY = 97, rotationFrom = -5, radius = 8))
        add(rect("Left arm", 62, 115, 10, 39, accent, rotationFrom = 8))
        add(rect("Right arm", 73, 116, 10, 39, accent, rotationFrom = -8))
        add(rect("Left leg", 112, 111, 11, 47, muted, toX = 92, toY = 118, rotationFrom = -28, rotationTo = 45))
        add(rect("Right leg", 130, 110, 11, 46, muted, toX = 142, toY = 113, rotationFrom = -22, rotationTo = -34))
        add(floor())
    }

    private fun russianTwist() = buildList {
        add(head("Head", 67, 62, toX = 93, toY = 62))
        add(rect("Torso", 80, 91, 20, 50, ink, rotationFrom = 24, rotationTo = -24, radius = 7))
        add(rect("Left arm", 65, 89, 9, 39, accent, toX = 95, toY = 89, rotationFrom = 38, rotationTo = -38))
        add(rect("Right arm", 95, 89, 9, 39, accent, toX = 65, toY = 89, rotationFrom = -38, rotationTo = 38))
        add(rect("Weight", 55, 104, 20, 20, bar, toX = 105, toY = 104, radius = 10))
        add(rect("Left thigh", 98, 116, 12, 42, muted, rotationFrom = 40))
        add(rect("Right thigh", 109, 120, 12, 40, muted, rotationFrom = 32))
        add(rect("Mat", 80, 136, 112, 12, ground, radius = 6))
    }

    private fun hangingLegRaise() = buildList {
        add(head("Head", 80, 59, toY = 58))
        add(rect("Torso", 80, 88, 19, 39, ink, radius = 7))
        add(rect("Left arm", 63, 49, 9, 42, accent, rotationFrom = 22))
        add(rect("Right arm", 97, 49, 9, 42, accent, rotationFrom = -22))
        add(rect("Left leg", 72, 121, 11, 47, muted, toX = 65, toY = 93, rotationFrom = 16, rotationTo = 78))
        add(rect("Right leg", 88, 121, 11, 47, muted, toX = 95, toY = 93, rotationFrom = -16, rotationTo = -78))
        add(rect("Pull-up bar", 80, 26, 104, 7, bar, radius = 4))
        add(floor())
    }

    private fun kettlebellSwing() = buildList {
        add(head("Head", 70, 55, toX = 80, toY = 43))
        add(rect("Torso", 79, 82, 20, 50, ink, rotationFrom = 38, rotationTo = 0, radius = 7))
        add(rect("Left arm", 70, 101, 10, 43, accent, rotationFrom = 35, rotationTo = 0))
        add(rect("Right arm", 90, 101, 10, 43, accent, rotationFrom = -35, rotationTo = 0))
        add(rect("Kettlebell", 80, 125, 27, 27, bar, toY = 51, radius = 13))
        add(rect("Left leg", 70, 119, 12, 43, muted, rotationFrom = 17, rotationTo = 0))
        add(rect("Right leg", 92, 119, 12, 43, muted, rotationFrom = -17, rotationTo = 0))
        add(floor())
    }

    private fun gobletSquat() = buildList {
        add(head("Head", 80, 58, toY = 80))
        add(rect("Torso", 80, 79, 18, 37, ink, toY = 101, radius = 7))
        add(rect("Kettlebell", 80, 92, 27, 27, bar, toY = 114, radius = 13))
        add(rect("Left arm", 66, 85, 10, 38, accent, toY = 107, rotationFrom = 20, rotationTo = 48))
        add(rect("Right arm", 94, 85, 10, 38, accent, toY = 107, rotationFrom = -20, rotationTo = -48))
        add(rect("Left thigh", 67, 105, 11, 41, ink, rotationFrom = 18, rotationTo = 66))
        add(rect("Right thigh", 93, 105, 11, 41, ink, rotationFrom = -18, rotationTo = -66))
        add(rect("Left shin", 60, 128, 10, 35, muted, rotationFrom = -10, rotationTo = -40))
        add(rect("Right shin", 100, 128, 10, 35, muted, rotationFrom = 10, rotationTo = 40))
        add(floor())
    }

    private fun stepUp() = buildList {
        add(head("Head", 65, 55, toX = 88, toY = 35))
        add(rect("Torso", 65, 84, 20, 42, ink, toX = 88, toY = 64, radius = 7))
        add(rect("Left arm", 47, 91, 10, 39, accent, toX = 70, toY = 71, rotationFrom = 12))
        add(rect("Right arm", 83, 91, 10, 39, accent, toX = 106, toY = 71, rotationFrom = -12))
        add(rect("Front leg", 74, 118, 12, 46, muted, toX = 96, toY = 100, rotationFrom = 25, rotationTo = 0))
        add(rect("Back leg", 55, 122, 12, 44, muted, toX = 76, toY = 104, rotationFrom = -16, rotationTo = -5))
        add(rect("Step box", 111, 123, 58, 34, bar, radius = 5))
        add(floor())
    }
}
