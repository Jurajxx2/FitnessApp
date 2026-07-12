import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './hooks/useAuth'
import { queryClient } from './lib/queryClient'
import { AdminRouteGuard } from './components/RouteGuard'
import { AdminLayout } from './components/AdminLayout'
import { AthleteRouteGuard } from './components/AthleteRouteGuard'
import { AthleteAppShell } from './components/AthleteAppShell'
import { PageViewLogger } from './components/PageViewLogger'
import { NoticeProvider } from './components/ui'

const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Verify = lazy(() => import('./pages/Verify'))
const AthleteLogin = lazy(() => import('./pages/AthleteLogin'))
const AthleteVerify = lazy(() => import('./pages/AthleteVerify'))
const Callback = lazy(() => import('./pages/Callback'))
const NotAdmin = lazy(() => import('./pages/NotAdmin'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Users = lazy(() => import('./pages/admin/Users'))
const UserDetail = lazy(() => import('./pages/admin/UserDetail'))
const Workouts = lazy(() => import('./pages/admin/Workouts'))
const Nutrition = lazy(() => import('./pages/admin/Nutrition'))
const Quotes = lazy(() => import('./pages/admin/Quotes'))
const Exercises = lazy(() => import('./pages/admin/Exercises'))
const Chat = lazy(() => import('./pages/admin/Chat'))
const MealPlanEditor = lazy(() => import('./pages/admin/MealPlanEditor'))
const NutritionHub = lazy(() => import('./pages/nutrition/Hub'))
const NutritionPlan = lazy(() => import('./pages/nutrition/Plan'))
const AthleteRecipes = lazy(() => import('./pages/nutrition/Recipes'))
const AthleteRecipeDetail = lazy(() => import('./pages/nutrition/RecipeDetail'))
const NutritionHistory = lazy(() => import('./pages/nutrition/History'))
const NutritionHistoryDetail = lazy(() => import('./pages/nutrition/HistoryDetail'))
const LogMeal = lazy(() => import('./pages/nutrition/LogMeal'))
const CheckInForm = lazy(() => import('./pages/checkins/CheckInForm'))
const CheckInHistory = lazy(() => import('./pages/checkins/CheckInHistory'))

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NoticeProvider>
            <BrowserRouter>
              <PageViewLogger />
              <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">Loading workspace…</div>}>
                <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Login />} />
              <Route path="/auth/verify" element={<Verify />} />
              <Route path="/auth/callback" element={<Callback />} />
              <Route path="/login" element={<AthleteLogin />} />
              <Route path="/verify" element={<AthleteVerify />} />
              <Route path="/403" element={<NotAdmin />} />
              <Route element={<AthleteRouteGuard />}>
                <Route element={<AthleteAppShell />}>
                  <Route path="/nutrition" element={<NutritionHub />} />
                  <Route path="/nutrition/plan" element={<NutritionPlan />} />
                  <Route path="/nutrition/recipes" element={<AthleteRecipes />} />
                  <Route path="/nutrition/recipes/:id" element={<AthleteRecipeDetail />} />
                  <Route path="/nutrition/history" element={<NutritionHistory />} />
                  <Route path="/nutrition/history/:id" element={<NutritionHistoryDetail />} />
                  <Route path="/nutrition/log" element={<LogMeal />} />
                  <Route path="/check-ins" element={<CheckInForm />} />
                  <Route path="/check-ins/history" element={<CheckInHistory />} />
                </Route>
              </Route>
              <Route element={<AdminRouteGuard />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin"           element={<Dashboard />} />
                  <Route path="/admin/users" element={<Users />}>
                    <Route path=":id" element={<UserDetail />} />
                  </Route>
                  <Route path="/admin/workouts"  element={<Workouts />} />
                  <Route path="/admin/nutrition" element={<Nutrition />} />
                  <Route path="/admin/nutrition/meal-plans/new" element={<MealPlanEditor />} />
                  <Route path="/admin/nutrition/meal-plans/:id"  element={<MealPlanEditor />} />
                  <Route path="/admin/quotes"     element={<Quotes />} />
                  <Route path="/admin/exercises" element={<Exercises />} />
                  <Route path="/admin/chat"      element={<Chat />} />
                </Route>
              </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </NoticeProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
