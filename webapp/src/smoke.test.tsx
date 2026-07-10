import { render, screen } from '@testing-library/react'
import App from './App'

test('unauthenticated app shows the login screen', async () => {
  render(<App />)
  expect(await screen.findByText('Poslať kód →')).toBeInTheDocument()
})
