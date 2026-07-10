import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './AppShell'

test('AppShell renders nav tabs', () => {
  render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/nutrition" element={<div>home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('Today')).toBeInTheDocument()
  expect(screen.getByText('Recipes')).toBeInTheDocument()
  expect(screen.getByText('home')).toBeInTheDocument()
})
