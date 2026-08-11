import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './hooks/useAuth'
import { queryClient } from './lib/queryClient'
import { AdminRouteGuard, AdminSecurityRouteGuard } from './components/RouteGuard'
import { AdminLayout } from './components/AdminLayout'
import { AthleteRouteGuard } from './components/AthleteRouteGuard'
import { AthleteAppShell } from './components/AthleteAppShell'
import { PageViewLogger } from './components/PageViewLogger'
import { PasswordRecoveryRedirect } from './components/PasswordRecoveryRedirect'
import { NoticeProvider } from './components/ui'
import { PublicLocaleProvider } from './i18n/PublicLocale'

const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Verify = lazy(() => import('./pages/Verify'))
const OtpLogin = lazy(() => import('./pages/OtpLogin'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Callback = lazy(() => import('./pages/Callback'))
const MfaChallenge = lazy(() => import('./pages/MfaChallenge'))
const AdminSecurity = lazy(() => import('./pages/admin/Security'))
const NotAdmin = lazy(() => import('./pages/NotAdmin'))
const Profile = lazy(() => import('./pages/Profile'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Users = lazy(() => import('./pages/admin/Users'))
const CreateUser = lazy(() => import('./pages/admin/CreateUser'))
const UserDetail = lazy(() => import('./pages/admin/UserDetail'))
const Workouts = lazy(() => import('./pages/admin/Workouts'))
const WorkoutEditor = lazy(() => import('./pages/admin/WorkoutEditor'))
const Nutrition = lazy(() => import('./pages/admin/Nutrition'))
const RecipeEditor = lazy(() => import('./pages/admin/RecipeEditor'))
const FoodEditor = lazy(() => import('./pages/admin/FoodEditor'))
const Quotes = lazy(() => import('./pages/admin/Quotes'))
const QuoteEditor = lazy(() => import('./pages/admin/QuoteEditor'))
const Exercises = lazy(() => import('./pages/admin/Exercises'))
const ExerciseEditor = lazy(() => import('./pages/admin/ExerciseEditor'))
const Chat = lazy(() => import('./pages/admin/Chat'))
const MealPlanEditor = lazy(() => import('./pages/admin/MealPlanEditor'))
const GeneratePlan = lazy(() => import('./pages/admin/GeneratePlan'))
const NutritionHub = lazy(() => import('./pages/nutrition/Hub'))
const AthleteRecipeDetail = lazy(() => import('./pages/nutrition/RecipeDetail'))
const NutritionHistory = lazy(() => import('./pages/nutrition/History'))
const NutritionHistoryDetail = lazy(() => import('./pages/nutrition/HistoryDetail'))
const LogMeal = lazy(() => import('./pages/nutrition/LogMeal'))
const CheckInForm = lazy(() => import('./pages/checkins/CheckInForm'))
const CheckInHistory = lazy(() => import('./pages/checkins/CheckInHistory'))
const ActivityHub = lazy(() => import('./pages/activity/Hub'))
const AthleteWorkouts = lazy(() => import('./pages/activity/Workouts'))
const CreateAthleteWorkout = lazy(() => import('./pages/activity/CreateWorkout'))
const WorkoutSession = lazy(() => import('./pages/activity/Session'))
const AthleteExercises = lazy(() => import('./pages/activity/Exercises'))
const WorkoutHistory = lazy(() => import('./pages/activity/History'))
const ActivityProgress = lazy(() => import('./pages/activity/Progress'))
const LogActivity = lazy(() => import('./pages/activity/LogActivity'))
const Messages = lazy(() => import('./pages/Messages'))
const NotFound = lazy(() => import('./pages/NotFound'))
const LegalPage = lazy(() => import('./pages/LegalPage'))

// Everything that used to sit inside <BrowserRouter> but outside <Routes>
// (page-view logging, the password-recovery redirect, and the lazy-route
// Suspense boundary) needs a home once RouterProvider owns rendering — this
// pathless root route is that home. It wraps every route below via <Outlet>.
//
// NoticeProvider lives here too, not in <App>: it needs useLocation() to pick a
// locale for its close button (admin vs. athlete surfaces), which only resolves
// inside the router. Because this layout route is pathless, it persists across
// navigation, so notice state survives route changes the same way it did before.
function RootLayout() {
  return (
    <NoticeProvider>
      <PageViewLogger />
      <PasswordRecoveryRedirect />
      <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">Loading workspace…</div>}>
        <Outlet />
      </Suspense>
    </NoticeProvider>
  )
}

// Exported so the routing smoke test can mount the exact same route table
// via createMemoryRouter without duplicating it.
export const appRoutes = createRoutesFromElements(
  <Route element={<RootLayout />}>
    <Route path="/" element={<Landing />} />
    <Route path="/privacy" element={<LegalPage kind="privacy" />} />
    <Route path="/terms" element={<LegalPage kind="terms" />} />
    <Route path="/login" element={<Login />} />
    <Route path="/login/otp" element={<OtpLogin />} />
    <Route path="/login/forgot-password" element={<ForgotPassword />} />
    <Route path="/login/reset-password" element={<ResetPassword />} />
    <Route path="/login/verify" element={<Verify />} />
    <Route path="/auth" element={<Navigate to="/login" replace />} />
    <Route path="/auth/verify" element={<Navigate to="/login/verify" replace />} />
    <Route path="/auth/callback" element={<Callback />} />
    <Route path="/login/mfa" element={<MfaChallenge />} />
    <Route path="/verify" element={<Navigate to="/login/verify" replace />} />
    <Route path="/403" element={<NotAdmin />} />
    <Route element={<AdminSecurityRouteGuard />}>
      <Route path="/admin/security" element={<AdminSecurity />} />
    </Route>
    <Route element={<AthleteRouteGuard />}>
      <Route element={<AthleteAppShell />}>
        <Route path="/nutrition" element={<NutritionHub />} />
        <Route path="/nutrition/plan" element={<NutritionHub />} />
        <Route path="/nutrition/recipes" element={<NutritionHub />} />
        <Route path="/nutrition/recipes/:id" element={<AthleteRecipeDetail />} />
        <Route path="/nutrition/history" element={<NutritionHistory />} />
        <Route path="/nutrition/history/:id" element={<NutritionHistoryDetail />} />
        <Route path="/nutrition/log" element={<LogMeal />} />
        <Route path="/check-ins" element={<CheckInForm />} />
        <Route path="/check-ins/history" element={<CheckInHistory />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/activity" element={<ActivityHub />} />
        <Route path="/activity/workouts" element={<AthleteWorkouts />} />
        <Route path="/activity/workouts/new" element={<CreateAthleteWorkout />} />
        <Route path="/activity/workouts/:workoutId" element={<AthleteWorkouts />} />
        <Route path="/activity/session" element={<WorkoutSession />} />
        <Route path="/activity/exercises" element={<AthleteExercises />} />
        <Route path="/activity/exercises/:exerciseId" element={<AthleteExercises />} />
        <Route path="/activity/history" element={<WorkoutHistory />} />
        <Route path="/activity/history/:logId" element={<WorkoutHistory />} />
        <Route path="/activity/progress" element={<ActivityProgress />} />
        <Route path="/activity/log" element={<LogActivity />} />
      </Route>
    </Route>
    <Route element={<AdminRouteGuard />}>
      <Route element={<AdminLayout />}>
        <Route path="/admin"           element={<Dashboard />} />
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/users/new" element={<CreateUser />} />
        <Route path="/admin/users/:id" element={<UserDetail />} />
        <Route path="/admin/workouts"  element={<Workouts />} />
        <Route path="/admin/workouts/new" element={<WorkoutEditor />} />
        <Route path="/admin/workouts/:id" element={<WorkoutEditor />} />
        <Route path="/admin/nutrition" element={<Nutrition />} />
        <Route path="/admin/nutrition/recipes/new" element={<RecipeEditor />} />
        <Route path="/admin/nutrition/recipes/:id" element={<RecipeEditor />} />
        <Route path="/admin/nutrition/foods/new" element={<FoodEditor />} />
        <Route path="/admin/nutrition/foods/:id" element={<FoodEditor />} />
        <Route path="/admin/nutrition/meal-plans/new" element={<MealPlanEditor />} />
        <Route path="/admin/nutrition/meal-plans/generate" element={<GeneratePlan />} />
        <Route path="/admin/nutrition/meal-plans/:id/preview" element={<GeneratePlan />} />
        <Route path="/admin/nutrition/meal-plans/:id"  element={<MealPlanEditor />} />
        <Route path="/admin/quotes"     element={<Quotes />} />
        <Route path="/admin/quotes/new" element={<QuoteEditor />} />
        <Route path="/admin/quotes/:id" element={<QuoteEditor />} />
        <Route path="/admin/exercises" element={<Exercises />} />
        <Route path="/admin/exercises/new" element={<ExerciseEditor />} />
        <Route path="/admin/exercises/:id" element={<ExerciseEditor />} />
        <Route path="/admin/chat"      element={<Chat />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFound />} />
  </Route>
)

// Created once, at module scope: rebuilding this on every render of <App>
// would recreate navigation state on every re-render.
const router = createBrowserRouter(appRoutes)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PublicLocaleProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </PublicLocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
