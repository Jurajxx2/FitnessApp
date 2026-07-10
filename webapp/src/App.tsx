import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './hooks/useAuth'
import { RouteGuard } from './components/RouteGuard'
import { AppShell } from './components/AppShell'
import Login from './pages/Login'
import Verify from './pages/Verify'
import Placeholder from './pages/nutrition/Placeholder'

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
                <Route path="/nutrition" element={<Placeholder name="Today" />} />
                <Route path="/nutrition/plan" element={<Placeholder name="Plan" />} />
                <Route path="/nutrition/recipes" element={<Placeholder name="Recipes" />} />
                <Route path="/nutrition/history" element={<Placeholder name="History" />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/nutrition" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
