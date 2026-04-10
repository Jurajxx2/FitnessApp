import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

// Persist session in localStorage so the admin stays logged in across tabs and
// browser restarts. This is safe because:
//   - CSP headers block XSS (the main localStorage attack vector)
//   - Supabase access tokens expire in 1 h; refresh tokens rotate on every use
//   - Supabase detects refresh token reuse and revokes the session automatically
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
