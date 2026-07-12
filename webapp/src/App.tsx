import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './hooks/useAuth'
import { RouteGuard } from './components/RouteGuard'
import { AppShell } from './components/AppShell'
import Login from './pages/Login'
import Verify from './pages/Verify'
import Hub from './pages/nutrition/Hub'
import Plan from './pages/nutrition/Plan'
import Recipes from './pages/nutrition/Recipes'
import RecipeDetail from './pages/nutrition/RecipeDetail'
import History from './pages/nutrition/History'
import HistoryDetail from './pages/nutrition/HistoryDetail'
import LogMeal from './pages/nutrition/LogMeal'
import CheckInForm from './pages/checkins/CheckInForm'
import CheckInHistory from './pages/checkins/CheckInHistory'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/verify" element={<Verify />} />
            <Route element={<RouteGuard />}>
              <Route element={<AppShell />}>
                <Route path="/nutrition" element={<Hub />} />
                <Route path="/nutrition/plan" element={<Plan />} />
                <Route path="/nutrition/recipes" element={<Recipes />} />
                <Route path="/nutrition/recipes/:id" element={<RecipeDetail />} />
                <Route path="/nutrition/history" element={<History />} />
                <Route path="/nutrition/history/:id" element={<HistoryDetail />} />
                <Route path="/nutrition/log" element={<LogMeal />} />
                <Route path="/check-ins" element={<CheckInForm />} />
                <Route path="/check-ins/history" element={<CheckInHistory />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/nutrition" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
