import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

// Use sessionStorage so tokens are cleared when the browser tab is closed.
// Tokens are never written to localStorage.
const sessionStorageAdapter = {
  getItem: (key: string) => sessionStorage.getItem(key),
  setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
  removeItem: (key: string) => sessionStorage.removeItem(key),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
