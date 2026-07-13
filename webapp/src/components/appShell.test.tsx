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
  expect(screen.getAllByText('Today').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Recipes').length).toBeGreaterThan(0)
  expect(screen.getByText('home')).toBeInTheDocument()
})
