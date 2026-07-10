import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RouteGuard } from './RouteGuard'
import * as auth from '../hooks/useAuth'

test('redirects to /login when unauthenticated', () => {
  vi.spyOn(auth, 'useAuth').mockReturnValue({ session: null, user: null, profile: null, isLoading: false })
  render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <Routes>
        <Route element={<RouteGuard />}>
          <Route path="/nutrition" element={<div>secret</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('login page')).toBeInTheDocument()
})
