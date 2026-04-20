import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImportExercisesModal from './ImportExercisesModal'
import { supabase } from '../../lib/supabase'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../lib/supabase', () => {
  const upsertSpy = vi.fn(() => Promise.resolve({ error: null }))
  const uploadSpy = vi.fn(() => Promise.resolve({ error: null }))
  const getPublicUrlSpy = vi.fn((path) => ({ data: { publicUrl: `https://supabase.com/${path}` } }))
  const invokeSpy = vi.fn((fn, { body }) => {
    if (fn === 'translate-exercise') {
      return Promise.resolve({ data: { translatedText: `Translated: ${body.text}` }, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  return {
    supabase: {
      from: vi.fn(() => ({
        upsert: upsertSpy,
      })),
      storage: {
        from: vi.fn(() => ({
          upload: uploadSpy,
          getPublicUrl: getPublicUrlSpy,
        })),
      },
      functions: {
        invoke: invokeSpy
      }
    },
  }
})

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

describe('ImportExercisesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('performs sync with AI translation and normalization', async () => {
    const exercisesData = [
      {
        id: 'bench-press',
        name: 'Bench Press',
        instructions: ['Lay on bench'],
        category: 'strength',
        images: ['bench.jpg'],
        primaryMuscles: ['chest ', 'Triceps'], 
        secondaryMuscles: [],
        equipment: 'barbell'
      }
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(exercisesData),
      blob: () => Promise.resolve(new Blob(['test'], { type: 'image/jpeg' })),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ImportExercisesModal open={true} onClose={() => {}} />
      </QueryClientProvider>
    )

    // Enable AI translation
    const aiCheckbox = screen.getByLabelText(/Translate to Czech/i)
    fireEvent.click(aiCheckbox)

    const syncButton = screen.getByText('Start Sync')
    fireEvent.click(syncButton)

    await waitFor(() => {
      // Check if upsert was called on the mock
      const upsertMock = supabase.from('exercises').upsert
      expect(upsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name_en: 'Bench Press',
            name_cs: 'Translated: Bench Press',
            primary_muscles: ['Chest', 'Triceps'],
            equipment_names: ['Barbell']
          })
        ]),
        { onConflict: 'external_id, source_provider' }
      )
    }, { timeout: 3000 })

    expect(screen.getByText('Done! Refreshing list...')).toBeDefined()
  })
})
