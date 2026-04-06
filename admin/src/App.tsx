import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './hooks/useTheme'
import { queryClient } from './lib/queryClient'
import { AdminRouteGuard } from './components/RouteGuard'
import { AdminLayout } from './components/AdminLayout'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Verify from './pages/Verify'
import Callback from './pages/Callback'
import NotAdmin from './pages/NotAdmin'

// Placeholders — replaced in Tasks 10-14
function Dashboard()  { return <div className="p-6 text-[var(--text)]">Dashboard — coming in Task 10</div> }
function Users()      { return <div className="p-6 text-[var(--text)]">Users — coming in Task 11</div> }
function UserDetail() { return <div className="p-6 text-[var(--text)]">User Detail — coming in Task 11</div> }
function Workouts()   { return <div className="p-6 text-[var(--text)]">Workouts — coming in Task 12</div> }
function Nutrition()  { return <div className="p-6 text-[var(--text)]">Nutrition — coming in Task 13</div> }
function Quotes()     { return <div className="p-6 text-[var(--text)]">Quotes — coming in Task 14</div> }

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Login />} />
            <Route path="/auth/verify" element={<Verify />} />
            <Route path="/auth/callback" element={<Callback />} />
            <Route path="/403" element={<NotAdmin />} />
            <Route element={<AdminRouteGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin"           element={<Dashboard />} />
                <Route path="/admin/users"     element={<Users />} />
                <Route path="/admin/users/:id" element={<UserDetail />} />
                <Route path="/admin/workouts"  element={<Workouts />} />
                <Route path="/admin/nutrition" element={<Nutrition />} />
                <Route path="/admin/quotes"    element={<Quotes />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
