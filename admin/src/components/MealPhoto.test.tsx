import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { signedMealPhotoUrl } from '../lib/storage'
import { MealPhoto } from './MealPhoto'

vi.mock('../lib/storage', () => ({ signedMealPhotoUrl: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

it('renders a private meal photo only after resolving its signed URL', async () => {
  vi.mocked(signedMealPhotoUrl).mockResolvedValue('https://storage.test/signed-photo')
  render(<MealPhoto path="user-1/meal_log-1.jpg" alt="Obed" className="thumb" />)

  expect(signedMealPhotoUrl).toHaveBeenCalledWith('user-1/meal_log-1.jpg')
  expect(await screen.findByRole('img', { name: 'Obed' })).toHaveAttribute('src', 'https://storage.test/signed-photo')
})
