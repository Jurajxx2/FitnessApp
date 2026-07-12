import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CheckInHistory from './CheckInHistory'

vi.mock('../../checkins/hooks', () => ({
  useCheckIns: () => ({
    isLoading: false,
    error: null,
    data: [{
      id: 'c1',
      user_id: 'u1',
      week_of: '2026-07-06',
      weight_kg: 74.5,
      energy_level: 4,
      sleep_quality: 3,
      stress_level: 2,
      training_adherence: 4,
      nutrition_adherence: 5,
      notes: 'Dobrý týždeň.',
      photo_front_path: 'u1/front.jpg',
      photo_side_path: null,
      coach_id: 'coach',
      coach_response: 'Pokračuj takto ďalej.',
      coach_response_at: '2026-07-08T12:00:00Z',
      created_at: '2026-07-06T12:00:00Z',
      updated_at: '2026-07-08T12:00:00Z',
    }],
  }),
}))

test('renders the same weekly metrics, photo state, notes, and coach response as mobile', () => {
  render(<MemoryRouter><CheckInHistory /></MemoryRouter>)

  expect(screen.getByText('74.5 kg')).toBeInTheDocument()
  expect(screen.getByText('4 tréningov')).toBeInTheDocument()
  expect(screen.getByText('Dobrý týždeň.')).toBeInTheDocument()
  expect(screen.getByText('Fotky priložené')).toBeInTheDocument()
  expect(screen.getByText('Odpoveď trénerky')).toBeInTheDocument()
  expect(screen.getByText('Pokračuj takto ďalej.')).toBeInTheDocument()
})
