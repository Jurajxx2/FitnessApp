import { render, screen } from '@testing-library/react'
import App from './App'

test('unauthenticated app shows the login screen', async () => {
  render(<App />)
  expect(await screen.findByRole('button', { name: 'Prihlásiť sa →' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Prihlásiť sa jednorazovým kódom' })).toBeInTheDocument()
})
