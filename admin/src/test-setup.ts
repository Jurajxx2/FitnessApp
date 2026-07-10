import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Pure UI tests import the shared client through some page modules. Supplying
// inert defaults keeps them independent from a developer's local .env file.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
