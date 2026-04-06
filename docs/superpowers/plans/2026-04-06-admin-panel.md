# Coach Foska Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React 19 + Vite + TypeScript admin web app in `admin/` with a public marketing landing page, Supabase OTP auth, and a protected admin panel for managing users, workouts, nutrition, and quotes.

**Architecture:** Single-page app using React Router v6 with a `RouteGuard` component that checks Supabase session and `is_admin` before rendering any admin route. TanStack Query v5 handles all server state. Theme is controlled via `data-theme` attribute on `<html>` with CSS custom properties. Supabase tokens are stored in `sessionStorage` only (never `localStorage`).

**Tech Stack:** React 19, Vite 6, TypeScript 5, React Router v6, TanStack Query v5, Supabase JS SDK v2, Tailwind CSS v4, Vitest + React Testing Library

---

## File Map

```
admin/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── netlify.toml
├── package.json
├── .env.example
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                  ← Tailwind import + CSS custom properties
│   ├── test-setup.ts              ← @testing-library/jest-dom import
│   ├── lib/
│   │   ├── supabase.ts            ← single Supabase client, sessionStorage
│   │   └── queryClient.ts         ← TanStack Query client config
│   ├── hooks/
│   │   ├── useAuth.ts             ← session, profile, isAdmin, isLoading
│   │   └── useTheme.ts            ← dark/light toggle + localStorage preference
│   ├── components/
│   │   ├── RouteGuard.tsx         ← redirects if no session or not admin
│   │   ├── AdminLayout.tsx        ← sidebar + topbar + <Outlet />
│   │   ├── Sidebar.tsx            ← nav items, theme toggle, user info, sign out
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Badge.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── SlideOver.tsx
│   │       └── Table.tsx
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── Verify.tsx
│   │   ├── Callback.tsx
│   │   ├── NotAdmin.tsx
│   │   └── admin/
│   │       ├── Dashboard.tsx
│   │       ├── Users.tsx
│   │       ├── UserDetail.tsx     ← slide-over panel, routed at /admin/users/:id
│   │       ├── Workouts.tsx       ← plan list + WorkoutEditor modal
│   │       ├── Nutrition.tsx      ← sub-tabs: Recipes + Meal Plans
│   │       └── Quotes.tsx
│   └── types/
│       └── database.ts            ← all DB row types
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `admin/package.json`
- Create: `admin/vite.config.ts`
- Create: `admin/tsconfig.json`
- Create: `admin/tsconfig.node.json`
- Create: `admin/index.html`
- Create: `admin/src/main.tsx`
- Create: `admin/src/App.tsx`
- Create: `admin/src/index.css`
- Create: `admin/src/test-setup.ts`
- Create: `admin/.env.example`
- Create: `admin/.gitignore`

- [ ] **Step 1: Create the admin directory and package.json**

```bash
mkdir -p admin/src/lib admin/src/hooks admin/src/components/ui admin/src/pages/admin admin/src/types
```

```json
// admin/package.json
{
  "name": "coach-foska-admin",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.5.0",
    "@tanstack/react-query": "^5.74.4",
    "@supabase/supabase-js": "^2.49.4"
  },
  "devDependencies": {
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.4.1",
    "@tailwindcss/vite": "^4.1.3",
    "tailwindcss": "^4.1.3",
    "typescript": "~5.8.3",
    "vite": "^6.3.2",
    "vitest": "^3.1.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.6.1",
    "@vitest/coverage-v8": "^3.1.1",
    "jsdom": "^26.1.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
// admin/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

- [ ] **Step 3: Create tsconfig files**

```json
// admin/tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

```json
// admin/tsconfig.app.json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

```json
// admin/tsconfig.node.json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!-- admin/index.html -->
<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Coach Foska Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/index.css with theme tokens**

```css
/* admin/src/index.css */
@import "tailwindcss";

/* Dark theme (default) */
:root,
[data-theme="dark"] {
  --bg: #0d0d0d;
  --bg-card: #161616;
  --bg-card-hover: #1c1c1c;
  --border: #1e1e1e;
  --border-subtle: #141414;
  --text: #e5e5e5;
  --text-muted: #555555;
  --text-disabled: #333333;
  --sidebar-bg: #0d0d0d;
  --sidebar-active-bg: #1c1c1c;
  --input-bg: #0f0f0f;
  --btn-primary-bg: #ffffff;
  --btn-primary-text: #000000;
}

[data-theme="light"] {
  --bg: #ffffff;
  --bg-card: #f5f5f5;
  --bg-card-hover: #eeeeee;
  --border: #e5e5e5;
  --border-subtle: #f0f0f0;
  --text: #111111;
  --text-muted: #888888;
  --text-disabled: #cccccc;
  --sidebar-bg: #fafafa;
  --sidebar-active-bg: #efefef;
  --input-bg: #ffffff;
  --btn-primary-bg: #000000;
  --btn-primary-text: #ffffff;
}

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 6: Create src/test-setup.ts**

```typescript
// admin/src/test-setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Create .env.example and .gitignore**

```bash
# admin/.env.example
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```
# admin/.gitignore
node_modules
dist
.env
.env.local
```

- [ ] **Step 8: Create placeholder src/main.tsx and src/App.tsx**

```tsx
// admin/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

```tsx
// admin/src/App.tsx
export default function App() {
  return <div>Coach Foska Admin — scaffold OK</div>
}
```

- [ ] **Step 9: Install dependencies and verify dev server starts**

```bash
cd admin && npm install
npm run dev
```

Expected: Vite dev server starts at `http://localhost:5173`, page shows "Coach Foska Admin — scaffold OK".

- [ ] **Step 10: Verify tests run**

```bash
cd admin && npm test
```

Expected: `No test files found` — that's fine at this stage.

- [ ] **Step 11: Commit**

```bash
git add admin/
git commit -m "feat(admin): scaffold React + Vite + TS + Tailwind v4 + Vitest"
```

---

## Task 2: netlify.toml — Security Headers + Redirects

**Files:**
- Create: `admin/netlify.toml`

- [ ] **Step 1: Create netlify.toml**

```toml
# admin/netlify.toml
[build]
  base    = "admin"
  publish = "dist"
  command = "npm run build"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options            = "DENY"
    X-Content-Type-Options     = "nosniff"
    Referrer-Policy            = "strict-origin-when-cross-origin"
    Permissions-Policy         = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy    = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; img-src 'self' data:; frame-ancestors 'none';"

# SPA fallback — all paths serve index.html
[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

- [ ] **Step 2: Commit**

```bash
git add admin/netlify.toml
git commit -m "feat(admin): add netlify.toml with CSP and SPA redirect"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `admin/src/types/database.ts`

- [ ] **Step 1: Write database types matching the Supabase schema**

```typescript
// admin/src/types/database.ts

export type Goal = 'weight_loss' | 'muscle_gain' | 'mental_strength'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  goal: Goal | null
  activity_level: ActivityLevel | null
  onboarding_complete: boolean
  is_admin: boolean
  is_blocked: boolean
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface Workout {
  id: string
  coach_id: string | null
  user_id: string | null
  name: string
  day_of_week: number | null  // 0=Mon … 6=Sun, null=any
  duration_minutes: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  name: string
  muscle_group: string | null
  sets: number
  reps: string
  rest_seconds: number
  tips: string | null
  wger_exercise_id: number | null
  sort_order: number
  created_at: string
}

export interface WorkoutLog {
  id: string
  user_id: string
  workout_id: string | null
  workout_name: string
  duration_minutes: number
  notes: string | null
  logged_at: string
  created_at: string
}

export interface MealPlan {
  id: string
  coach_id: string | null
  user_id: string | null
  name: string
  description: string | null
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Meal {
  id: string
  meal_plan_id: string
  name: string
  time_of_day: string | null
  sort_order: number
}

export interface MealFood {
  id: string
  meal_id: string
  name: string
  amount_grams: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface Recipe {
  id: string
  name: string
  description: string | null
  prep_time_min: number | null
  servings: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  name: string
  quantity: number | null
  unit: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sort_order: number
}

export interface MealPlanRecipe {
  id: string
  meal_plan_id: string
  recipe_id: string
  meal_id: string | null
  meal_type: MealType | null
  day_of_week: number | null
  created_at: string
}

export interface DailyQuote {
  id: string
  text: string
  author: string | null
  is_active: boolean
  scheduled_date: string | null
  created_at: string
  updated_at: string
}

export interface WeightEntry {
  id: string
  user_id: string
  weight_kg: number
  recorded_at: string
  notes: string | null
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/types/
git commit -m "feat(admin): add TypeScript database types"
```

---

## Task 4: Supabase Client + TanStack Query Client

**Files:**
- Create: `admin/src/lib/supabase.ts`
- Create: `admin/src/lib/queryClient.ts`

- [ ] **Step 1: Write failing test for supabase client**

```typescript
// admin/src/lib/supabase.test.ts
import { describe, it, expect } from 'vitest'
import { supabase } from './supabase'

describe('supabase client', () => {
  it('is a single shared instance', () => {
    // Re-importing should return the same instance
    const { supabase: supabase2 } = require('./supabase')
    expect(supabase).toBe(supabase2)
  })

  it('exposes auth and from methods', () => {
    expect(typeof supabase.auth.signInWithOtp).toBe('function')
    expect(typeof supabase.from).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd admin && npm test
```

Expected: FAIL — `supabase` is not defined.

- [ ] **Step 3: Implement Supabase client**

```typescript
// admin/src/lib/supabase.ts
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
```

- [ ] **Step 4: Create .env for local dev (do not commit)**

Create `admin/.env` (already gitignored):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 5: Create TanStack Query client**

```typescript
// admin/src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,        // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
```

- [ ] **Step 6: Commit**

```bash
git add admin/src/lib/
git commit -m "feat(admin): add Supabase client (sessionStorage) and TanStack Query client"
```

---

## Task 5: Theme System

**Files:**
- Create: `admin/src/hooks/useTheme.ts`
- Test: `admin/src/hooks/useTheme.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// admin/src/hooks/useTheme.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.setAttribute('data-theme', 'dark')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to dark theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe('dark')
  })

  it('reads saved theme from localStorage', () => {
    localStorage.setItem('foska-theme', 'light')
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe('light')
  })

  it('toggles theme and updates <html> data-theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('persists theme to localStorage on toggle', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggleTheme())
    expect(localStorage.getItem('foska-theme')).toBe('light')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd admin && npm test
```

Expected: FAIL — `useTheme` not found.

- [ ] **Step 3: Implement useTheme hook**

```typescript
// admin/src/hooks/useTheme.ts
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const STORAGE_KEY = 'foska-theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return (saved === 'light' || saved === 'dark') ? saved : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd admin && npm test
```

Expected: 4 tests PASS in `useTheme.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add admin/src/hooks/useTheme.ts admin/src/hooks/useTheme.test.ts
git commit -m "feat(admin): add useTheme hook with dark-default and localStorage persistence"
```

---

## Task 6: UI Primitives

**Files:**
- Create: `admin/src/components/ui/Button.tsx`
- Create: `admin/src/components/ui/Badge.tsx`
- Create: `admin/src/components/ui/Input.tsx`
- Create: `admin/src/components/ui/Modal.tsx`
- Create: `admin/src/components/ui/SlideOver.tsx`
- Create: `admin/src/components/ui/Table.tsx`
- Create: `admin/src/components/ui/index.ts`
- Test: `admin/src/components/ui/Button.test.tsx`

- [ ] **Step 1: Write failing Button test**

```tsx
// admin/src/components/ui/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled when disabled prop is passed', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows loading state', () => {
    render(<Button loading>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd admin && npm test
```

Expected: FAIL — `Button` not found.

- [ ] **Step 3: Implement all UI primitives**

```tsx
// admin/src/components/ui/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', loading, disabled, children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0'
  const variants = {
    primary: 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-85',
    ghost: 'bg-transparent text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--text-muted)]',
    danger: 'bg-transparent text-red-400 border border-red-900 hover:bg-red-900/20',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <span className="animate-spin mr-2">⟳</span> : null}
      {children}
    </button>
  )
}
```

```tsx
// admin/src/components/ui/Badge.tsx
interface BadgeProps {
  status: 'active' | 'inactive' | 'blocked'
}

const config = {
  active:   { label: 'Active',   cls: 'bg-green-950 text-green-400' },
  inactive: { label: 'Inactive', cls: 'bg-zinc-800 text-zinc-500'   },
  blocked:  { label: 'Blocked',  cls: 'bg-red-950  text-red-400'    },
}

export function Badge({ status }: BadgeProps) {
  const { label, cls } = config[status]
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}
```

```tsx
// admin/src/components/ui/Input.tsx
import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--text-muted)] transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
```

```tsx
// admin/src/components/ui/Modal.tsx
import { ReactNode, useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-bold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer border-0 bg-transparent text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  )
}
```

```tsx
// admin/src/components/ui/SlideOver.tsx
import { ReactNode, useEffect } from 'react'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function SlideOver({ open, onClose, title, children }: SlideOverProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <div className={`fixed inset-0 z-50 flex justify-end transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-lg bg-[var(--bg-card)] border-l border-[var(--border)] h-full overflow-y-auto flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
          <h2 className="text-base font-bold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer border-0 bg-transparent text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-6 flex-1">{children}</div>
      </div>
    </div>
  )
}
```

```tsx
// admin/src/components/ui/Table.tsx
import { ReactNode } from 'react'

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  )
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider pb-3 pr-4 border-b border-[var(--border)]">
      {children}
    </th>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`text-sm text-[var(--text-muted)] py-3 pr-4 border-b border-[var(--border-subtle)] ${className}`}>
      {children}
    </td>
  )
}
```

```typescript
// admin/src/components/ui/index.ts
export { Button } from './Button'
export { Badge } from './Badge'
export { Input } from './Input'
export { Modal } from './Modal'
export { SlideOver } from './SlideOver'
export { Table, Th, Td } from './Table'
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd admin && npm test
```

Expected: Button tests PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add admin/src/components/ui/
git commit -m "feat(admin): add UI primitives — Button, Badge, Input, Modal, SlideOver, Table"
```

---

## Task 7: Auth Hook + Auth Pages

**Files:**
- Create: `admin/src/hooks/useAuth.ts`
- Test: `admin/src/hooks/useAuth.test.ts`
- Create: `admin/src/pages/Login.tsx`
- Create: `admin/src/pages/Verify.tsx`
- Create: `admin/src/pages/Callback.tsx`
- Create: `admin/src/pages/NotAdmin.tsx`

- [ ] **Step 1: Write failing useAuth tests**

```typescript
// admin/src/hooks/useAuth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from './useAuth'

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn(),
  },
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.isLoading).toBe(true)
  })

  it('returns no session initially when supabase returns null', async () => {
    const { result } = renderHook(() => useAuth())
    // After async resolution, session should be null
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(result.current.isAdmin).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd admin && npm test
```

Expected: FAIL — `useAuth` not found.

- [ ] **Step 3: Implement useAuth hook**

```typescript
// admin/src/hooks/useAuth.ts
import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  isLoading: boolean
}

const initialState: AuthState = {
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  isLoading: true,
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(initialState)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      if (session) {
        const profile = await fetchProfile(session.user.id)
        setState({ session, user: session.user, profile, isAdmin: profile?.is_admin ?? false, isLoading: false })
      } else {
        setState({ ...initialState, isLoading: false })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!mounted) return
      if (session) {
        const profile = await fetchProfile(session.user.id)
        setState({ session, user: session.user, profile, isAdmin: profile?.is_admin ?? false, isLoading: false })
      } else {
        setState({ ...initialState, isLoading: false })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd admin && npm test
```

Expected: 2 tests PASS in `useAuth.test.ts`.

- [ ] **Step 5: Implement Login page**

```tsx
// admin/src/pages/Login.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Input } from '../components/ui'
import { Button } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      sessionStorage.setItem('otp-email', email.trim().toLowerCase())
      navigate('/auth/verify')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-xs font-bold tracking-widest text-white uppercase mb-8">Coach Foska</div>
        <h1 className="text-xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
          Enter your email to receive a one-time login code. Admin access is required.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="submit" loading={loading} disabled={!email}>
            Send login code →
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Implement Verify page**

```tsx
// admin/src/pages/Verify.tsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

export default function Verify() {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const navigate = useNavigate()
  const email = sessionStorage.getItem('otp-email') ?? ''

  useEffect(() => {
    if (!email) navigate('/auth')
  }, [email, navigate])

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  function handleDigitChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const next = [...digits]
    next[index] = value.slice(-1)
    setDigits(next)
    if (value && index < 5) inputs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const token = digits.join('')
    if (token.length < 6) return
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    // Check admin role
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', data.user!.id).single()
    sessionStorage.removeItem('otp-email')
    navigate(profile?.is_admin ? '/admin' : '/403', { replace: true })
  }

  async function handleResend() {
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setResendCooldown(60)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-xs font-bold tracking-widest text-white uppercase mb-8">Coach Foska</div>
        <h1 className="text-xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
          We sent a 6-digit code to <span className="text-[var(--text)]">{email}</span>.
        </p>
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex gap-2 justify-center">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-11 h-12 text-center text-lg font-bold bg-[var(--input-bg)] border border-[var(--border)] rounded-md text-[var(--text)] outline-none focus:border-[var(--text-muted)]"
              />
            ))}
          </div>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <Button type="submit" loading={loading} disabled={digits.join('').length < 6}>
            Verify code
          </Button>
        </form>
        <p className="text-xs text-[var(--text-muted)] text-center mt-4">
          {resendCooldown > 0
            ? `Resend in ${resendCooldown}s`
            : <button onClick={handleResend} className="text-[var(--text)] underline cursor-pointer bg-transparent border-0">Resend code</button>}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Implement Callback page**

```tsx
// admin/src/pages/Callback.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Handles Supabase magic link redirects.
// Supabase exchanges the URL fragment for a session automatically on init.
// We just need to wait for the session and then redirect.
export default function Callback() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()
        navigate(profile?.is_admin ? '/admin' : '/403', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-[var(--text-muted)] text-sm">Signing you in…</p>
    </div>
  )
}
```

- [ ] **Step 8: Implement NotAdmin page**

```tsx
// admin/src/pages/NotAdmin.tsx
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

export default function NotAdmin() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">403</div>
        <h1 className="text-xl font-bold text-white mb-2">Access denied</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Your account does not have admin access. Contact the administrator.
        </p>
        <Button variant="ghost" onClick={handleSignOut}>Sign out</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add admin/src/hooks/useAuth.ts admin/src/hooks/useAuth.test.ts admin/src/pages/
git commit -m "feat(admin): auth hook + Login, Verify, Callback, NotAdmin pages"
```

---

## Task 8: RouteGuard + AdminLayout + Sidebar + App Router

**Files:**
- Create: `admin/src/components/RouteGuard.tsx`
- Test: `admin/src/components/RouteGuard.test.tsx`
- Create: `admin/src/components/Sidebar.tsx`
- Create: `admin/src/components/AdminLayout.tsx`
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Write failing RouteGuard tests**

```tsx
// admin/src/components/RouteGuard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AdminRouteGuard } from './RouteGuard'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../hooks/useAuth'

const mockUseAuth = vi.mocked(useAuth)

describe('AdminRouteGuard', () => {
  it('shows loading while auth resolves', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: true })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  it('redirects to /auth when no session', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: false })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/auth" element={<div>Login page</div>} />
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('redirects to /403 when not admin', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: {} as any, isAdmin: false, isLoading: false })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/403" element={<div>Not admin</div>} />
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Not admin')).toBeInTheDocument()
  })

  it('renders children when admin', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: {} as any, isAdmin: true, isLoading: false })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd admin && npm test
```

Expected: FAIL — `RouteGuard` not found.

- [ ] **Step 3: Implement RouteGuard**

```tsx
// admin/src/components/RouteGuard.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AdminRouteGuard() {
  const { session, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[var(--text-muted)] text-sm">Loading…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/auth" replace />
  if (!isAdmin) return <Navigate to="/403" replace />
  return <Outlet />
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd admin && npm test
```

Expected: 4 RouteGuard tests PASS.

- [ ] **Step 5: Implement Sidebar**

```tsx
// admin/src/components/Sidebar.tsx
import { NavLink, useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { to: '/admin',           label: 'Dashboard', icon: '▪' },
  { to: '/admin/users',     label: 'Users',      icon: '👥' },
  { to: '/admin/workouts',  label: 'Workouts',   icon: '🏋️' },
  { to: '/admin/nutrition', label: 'Nutrition',  icon: '🥗' },
  { to: '/admin/quotes',    label: 'Quotes',     icon: '💬' },
]

export function Sidebar() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <aside className="w-[200px] flex-shrink-0 flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--border)] h-full">
      <div className="px-4 pt-5 pb-2">
        <span className="text-xs font-extrabold tracking-widest text-[var(--text)] uppercase">Coach Foska</span>
      </div>

      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        <p className="text-[9px] font-bold text-[var(--text-disabled)] uppercase tracking-widest px-3 mb-1">Menu</p>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors ${
                isActive
                  ? 'bg-[var(--sidebar-active-bg)] text-[var(--text)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`
            }
          >
            <span className="text-sm w-4 text-center">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-[var(--border)] flex flex-col gap-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 px-2 py-1.5 w-full bg-transparent border-0 cursor-pointer text-left"
        >
          <div className="relative w-8 h-4 rounded-full bg-[var(--border)] flex-shrink-0">
            <div className={`absolute top-0.5 w-3 h-3 bg-[var(--text)] rounded-full transition-all ${theme === 'light' ? 'left-4' : 'left-0.5'}`} />
          </div>
          <span className="text-xs text-[var(--text-muted)]">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>

        {/* User + sign out */}
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-7 h-7 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] flex-shrink-0 font-bold uppercase">
            {user?.email?.slice(0, 2) ?? 'CF'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
            <button onClick={handleSignOut} className="text-[10px] text-[var(--text-disabled)] hover:text-red-400 bg-transparent border-0 cursor-pointer p-0">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 6: Implement AdminLayout**

```tsx
// admin/src/components/AdminLayout.tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Wire up App.tsx with all routes**

```tsx
// admin/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './hooks/useTheme'
import { queryClient } from './lib/queryClient'
import { AdminRouteGuard } from './components/RouteGuard'
import { AdminLayout } from './components/AdminLayout'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Verify from './pages/Verify'
import Callback from './pages/Callback'
import NotAdmin from './pages/NotAdmin'

// Placeholder admin pages — will be filled in subsequent tasks
function Dashboard()  { return <div className="p-6 text-[var(--text)]">Dashboard</div> }
function Users()      { return <div className="p-6 text-[var(--text)]">Users</div> }
function UserDetail() { return <div className="p-6 text-[var(--text)]">User Detail</div> }
function Workouts()   { return <div className="p-6 text-[var(--text)]">Workouts</div> }
function Nutrition()  { return <div className="p-6 text-[var(--text)]">Nutrition</div> }
function Quotes()     { return <div className="p-6 text-[var(--text)]">Quotes</div> }

// Landing page placeholder — will be replaced in Task 10
function LandingPlaceholder() { return <div className="p-6 text-white bg-[#0a0a0a] min-h-screen">Landing</div> }

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPlaceholder />} />
            <Route path="/auth" element={<Login />} />
            <Route path="/auth/verify" element={<Verify />} />
            <Route path="/auth/callback" element={<Callback />} />
            <Route path="/403" element={<NotAdmin />} />
            <Route element={<AdminRouteGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin"           element={<Dashboard />} />
                <Route path="/admin/users"     element={<Users />} />
                <Route path="/admin/users/:id" element={<UserDetail />} />
                <Route path="/admin/workouts"  element={<Workouts />} />
                <Route path="/admin/nutrition" element={<Nutrition />} />
                <Route path="/admin/quotes"    element={<Quotes />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 8: Run all tests**

```bash
cd admin && npm test
```

Expected: All existing tests PASS (useTheme: 4, useAuth: 2, Button: 4, RouteGuard: 4).

- [ ] **Step 9: Verify app renders in browser**

```bash
cd admin && npm run dev
```

Navigate to `http://localhost:5173` — should show landing placeholder. Navigate to `http://localhost:5173/auth` — should show the login form.

- [ ] **Step 10: Commit**

```bash
git add admin/src/components/ admin/src/App.tsx
git commit -m "feat(admin): RouteGuard, AdminLayout, Sidebar, full router wiring"
```

---

## Task 9: Landing Page

**Files:**
- Modify: `admin/src/App.tsx` (replace `LandingPlaceholder` import)
- Create: `admin/src/pages/Landing.tsx`

- [ ] **Step 1: Create Landing page**

```tsx
// admin/src/pages/Landing.tsx
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DailyQuote } from '../types/database'

export default function Landing() {
  const navigate = useNavigate()
  const [quote, setQuote] = useState<DailyQuote | null>(null)

  useEffect(() => {
    supabase
      .from('daily_quotes')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setQuote(data))
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* NAV */}
      <nav className="flex items-center justify-between px-12 py-5 border-b border-[#1a1a1a] sticky top-0 bg-[rgba(10,10,10,0.92)] backdrop-blur-md z-50">
        <span className="text-sm font-extrabold tracking-widest uppercase">Coach Foska</span>
        <div className="flex items-center gap-8">
          <a href="#about"    className="text-sm text-zinc-500 hover:text-white transition-colors">About</a>
          <a href="#features" className="text-sm text-zinc-500 hover:text-white transition-colors">Features</a>
          <a href="#how"      className="text-sm text-zinc-500 hover:text-white transition-colors">How it works</a>
          <button
            onClick={() => navigate('/auth')}
            className="px-5 py-2 bg-white text-black text-sm font-semibold rounded-md hover:opacity-85 transition-opacity cursor-pointer border-0"
          >
            Login →
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,255,255,0.04), transparent)' }} />
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-400 mb-8">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
          Now available on Android & iOS
        </div>
        <h1 className="text-6xl md:text-8xl font-extrabold leading-tight tracking-tight mb-6 max-w-3xl">
          Your fitness.<br /><span className="text-zinc-600">Guided by</span> an expert.
        </h1>
        <p className="text-lg text-zinc-500 max-w-md leading-relaxed mb-10">
          Personalised workout plans, nutrition guidance, and daily motivation — all in one place.
        </p>
        <div className="flex gap-3">
          <button className="px-8 py-3.5 bg-white text-black text-sm font-bold rounded-lg hover:opacity-85 transition-opacity cursor-pointer border-0">
            Download the app
          </button>
          <a href="#features" className="px-8 py-3.5 text-sm font-semibold border border-zinc-800 rounded-lg hover:border-zinc-600 transition-colors">
            Learn more
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-12 py-20 max-w-6xl mx-auto">
        <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4">What you get</p>
        <h2 className="text-4xl font-extrabold tracking-tight mb-3">Everything your<br />fitness journey needs.</h2>
        <p className="text-zinc-500 text-base max-w-md leading-relaxed mb-12">Built around your goals, designed to keep you consistent.</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: '🏋️', title: 'Personalised Workouts',  desc: 'Plans built by your coach, structured for your schedule.' },
            { icon: '🥗', title: 'Nutrition Guidance',     desc: 'Meal plans calibrated to your macros and lifestyle.' },
            { icon: '📈', title: 'Progress Tracking',      desc: 'Log weight, track workouts, watch results compound.' },
            { icon: '💬', title: 'Daily Motivation',       desc: 'A fresh quote from your coach every single day.' },
            { icon: '📱', title: 'Android & iOS',          desc: 'Native app on both platforms, always in sync.' },
            { icon: '🔒', title: 'Private & Secure',       desc: 'Your data belongs to you. Secured end-to-end.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-zinc-700 transition-colors">
              <div className="w-9 h-9 bg-zinc-900 rounded-lg flex items-center justify-center text-base mb-4">{icon}</div>
              <h3 className="text-sm font-bold mb-2">{title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-zinc-900" />

      {/* HOW IT WORKS */}
      <section id="how" className="px-12 py-20 max-w-6xl mx-auto">
        <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4">How it works</p>
        <h2 className="text-4xl font-extrabold tracking-tight mb-12">Simple. Structured. Effective.</h2>
        <div className="grid grid-cols-4 gap-6">
          {[
            { n: 1, title: 'Download & sign up',     desc: 'Create your account with just your email.' },
            { n: 2, title: 'Complete onboarding',    desc: 'Share your goals so your coach can personalise your plan.' },
            { n: 3, title: 'Get your plan',          desc: 'Your coach assigns a tailored workout and meal plan.' },
            { n: 4, title: 'Train & track',          desc: 'Follow your plan daily and watch results compound.' },
          ].map(({ n, title, desc }) => (
            <div key={n}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-4 ${n === 1 ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-600'}`}>
                {n}
              </div>
              <h3 className="text-sm font-bold mb-2">{title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* QUOTE BANNER */}
      <div className="border-t border-b border-zinc-900 py-16 text-center px-6">
        <blockquote className="text-3xl font-bold tracking-tight max-w-2xl mx-auto leading-snug mb-3">
          <span className="text-zinc-700">"</span>
          {quote?.text ?? 'Every rep counts. Show up, push hard, earn it.'}
          <span className="text-zinc-700">"</span>
        </blockquote>
        <cite className="text-xs text-zinc-600 not-italic">— {quote?.author ?? 'Coach Foska'}</cite>
      </div>

      {/* FOOTER */}
      <footer className="flex items-center justify-between px-12 py-8 border-t border-zinc-900">
        <span className="text-xs font-extrabold tracking-widest uppercase text-zinc-700">Coach Foska</span>
        <div className="flex gap-6">
          <a href="#" className="text-xs text-zinc-600 hover:text-zinc-400">Privacy Policy</a>
          <a href="#" className="text-xs text-zinc-600 hover:text-zinc-400">Terms</a>
          <a href="#" className="text-xs text-zinc-600 hover:text-zinc-400">Contact</a>
        </div>
        <span className="text-xs text-zinc-800">© 2025 Coach Foska</span>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Wire Landing into App.tsx**

Replace the `LandingPlaceholder` function and its route in `admin/src/App.tsx`:

```tsx
// Replace the top of App.tsx — remove LandingPlaceholder, add:
import Landing from './pages/Landing'

// In the Routes, the "/" route becomes:
<Route path="/" element={<Landing />} />
```

- [ ] **Step 3: Verify in browser**

```bash
cd admin && npm run dev
```

Navigate to `http://localhost:5173` — landing page renders with hero, features, how it works, quote banner, footer.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/Landing.tsx admin/src/App.tsx
git commit -m "feat(admin): landing page — hero, features, how-it-works, quote banner, footer"
```

---

## Task 10: Dashboard Tab

**Files:**
- Create: `admin/src/pages/admin/Dashboard.tsx`
- Modify: `admin/src/App.tsx` (replace placeholder)

- [ ] **Step 1: Create Dashboard page**

```tsx
// admin/src/pages/admin/Dashboard.tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { DailyQuote } from '../../types/database'
import { Button } from '../../components/ui'

function useStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [users, workouts, mealPlans, recipes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('workouts').select('id', { count: 'exact', head: true }),
        supabase.from('meal_plans').select('id', { count: 'exact', head: true }),
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
      ])
      return {
        users: users.count ?? 0,
        workouts: workouts.count ?? 0,
        mealPlans: mealPlans.count ?? 0,
        recipes: recipes.count ?? 0,
      }
    },
  })
}

function useActiveQuote() {
  return useQuery<DailyQuote | null>({
    queryKey: ['active-quote'],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_quotes')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      return data
    },
  })
}

function useRecentActivity() {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const [logs, newUsers] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('id, workout_name, logged_at, profiles(full_name, email)')
          .order('logged_at', { ascending: false })
          .limit(5),
        supabase
          .from('profiles')
          .select('id, full_name, email, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      return { logs: logs.data ?? [], newUsers: newUsers.data ?? [] }
    },
  })
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
      <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest mb-2">{label}</p>
      <p className="text-3xl font-extrabold text-[var(--text)]">{value}</p>
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Dashboard() {
  const stats = useStats()
  const activeQuote = useActiveQuote()
  const activity = useRecentActivity()
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-[var(--text)]">Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Users"   value={stats.data?.users    ?? 0} />
        <StatCard label="Workout Plans" value={stats.data?.workouts  ?? 0} />
        <StatCard label="Meal Plans"    value={stats.data?.mealPlans ?? 0} />
        <StatCard label="Recipes"       value={stats.data?.recipes   ?? 0} />
      </div>

      {/* Active Quote */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 mb-5">
        <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest mb-2">Active Quote</p>
        {activeQuote.data ? (
          <>
            <p className="text-sm text-[var(--text-muted)] italic leading-relaxed">"{activeQuote.data.text}"</p>
            <p className="text-xs text-[var(--text-disabled)] mt-1">— {activeQuote.data.author}</p>
          </>
        ) : (
          <p className="text-sm text-[var(--text-disabled)]">No active quote. <button className="underline cursor-pointer bg-transparent border-0 text-[var(--text-muted)] text-sm" onClick={() => navigate('/admin/quotes')}>Set one →</button></p>
        )}
      </div>

      {/* Panels */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
          <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest mb-3">Recent Activity</p>
          {activity.isLoading && <p className="text-xs text-[var(--text-disabled)]">Loading…</p>}
          {activity.data?.logs.map(log => (
            <div key={log.id} className="flex items-center gap-2 py-2 border-b border-[var(--border-subtle)] last:border-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-xs text-[var(--text-muted)] flex-1">
                {(log.profiles as any)?.full_name ?? (log.profiles as any)?.email} logged {log.workout_name}
              </span>
              <span className="text-[10px] text-[var(--text-disabled)]">{timeAgo(log.logged_at)}</span>
            </div>
          ))}
          {activity.data?.newUsers.slice(0, 3).map(u => (
            <div key={u.id} className="flex items-center gap-2 py-2 border-b border-[var(--border-subtle)] last:border-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--border)] flex-shrink-0" />
              <span className="text-xs text-[var(--text-muted)] flex-1">New user: {u.full_name ?? u.email}</span>
              <span className="text-[10px] text-[var(--text-disabled)]">{timeAgo(u.created_at)}</span>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
          <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="w-full justify-start" onClick={() => navigate('/admin/workouts')}>
              + Create workout plan
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/nutrition')}>
              + Add recipe
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/nutrition')}>
              + Create meal plan
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/quotes')}>
              ✏️ Update active quote
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire Dashboard into App.tsx**

```tsx
// In admin/src/App.tsx, replace:
// function Dashboard() { return <div ...>Dashboard</div> }
// with:
import Dashboard from './pages/admin/Dashboard'
```

- [ ] **Step 3: Run tests**

```bash
cd admin && npm test
```

Expected: All previous tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/admin/Dashboard.tsx admin/src/App.tsx
git commit -m "feat(admin): dashboard — stats, active quote, recent activity, quick actions"
```

---

## Task 11: Users Tab + User Detail

**Files:**
- Create: `admin/src/pages/admin/Users.tsx`
- Create: `admin/src/pages/admin/UserDetail.tsx`
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Create Users list page**

```tsx
// admin/src/pages/admin/Users.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Badge, Input, Table, Th, Td } from '../../components/ui'
import type { Profile } from '../../types/database'

function useUsers() {
  return useQuery<Profile[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

function deriveStatus(p: Profile): 'active' | 'inactive' | 'blocked' {
  if (p.is_blocked) return 'blocked'
  if (!p.onboarding_complete) return 'inactive'
  return 'active'
}

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Weight loss',
  muscle_gain: 'Muscle gain',
  mental_strength: 'Mental strength',
}

export default function Users() {
  const { data: users = [], isLoading } = useUsers()
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-[var(--text)]">
          Users <span className="text-sm text-[var(--text-disabled)] font-normal ml-2">{users.length} total</span>
        </h1>
      </div>

      <div className="mb-4 max-w-xs">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Goal</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.id} className="hover:bg-[var(--bg-card-hover)] cursor-pointer" onClick={() => navigate(`/admin/users/${user.id}`)}>
                <Td className="text-[var(--text)]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] flex-shrink-0 uppercase">
                      {(user.full_name ?? user.email).slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{user.full_name ?? '—'}</p>
                      <p className="text-xs text-[var(--text-disabled)]">{user.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>{user.goal ? (GOAL_LABELS[user.goal] ?? user.goal) : '—'}</Td>
                <Td><Badge status={deriveStatus(user)} /></Td>
                <Td>{new Date(user.created_at).toLocaleDateString()}</Td>
                <Td><span className="text-xs text-[var(--text-disabled)]">View →</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create UserDetail slide-over page**

```tsx
// admin/src/pages/admin/UserDetail.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SlideOver, Button, Input, Badge } from '../../components/ui'
import type { Profile, Workout, MealPlan, WeightEntry } from '../../types/database'

function useUser(id: string) {
  return useQuery<Profile>({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

function useWorkoutPlans() {
  return useQuery<Pick<Workout, 'id' | 'name'>[]>({
    queryKey: ['workout-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('workouts').select('id, name').order('name')
      return (data ?? []) as Pick<Workout, 'id' | 'name'>[]
    },
  })
}

function useMealPlans() {
  return useQuery<Pick<MealPlan, 'id' | 'name'>[]>({
    queryKey: ['meal-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('meal_plans').select('id, name').order('name')
      return (data ?? []) as Pick<MealPlan, 'id' | 'name'>[]
    },
  })
}

function useWeightHistory(userId: string) {
  return useQuery<WeightEntry[]>({
    queryKey: ['weight-history', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(10)
      return data ?? []
    },
  })
}

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Weight loss', muscle_gain: 'Muscle gain', mental_strength: 'Mental strength',
}
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary', lightly_active: 'Lightly active',
  moderately_active: 'Moderately active', active: 'Active', very_active: 'Very active',
}

function deriveStatus(p: Profile): 'active' | 'inactive' | 'blocked' {
  if (p.is_blocked) return 'blocked'
  if (!p.onboarding_complete) return 'inactive'
  return 'active'
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: user, isLoading } = useUser(id!)
  const { data: workoutPlans = [] } = useWorkoutPlans()
  const { data: mealPlans = [] } = useMealPlans()
  const { data: weightHistory = [] } = useWeightHistory(id!)

  const [adminNotes, setAdminNotes] = useState('')

  const updateProfile = useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', id] }),
  })

  const assignWorkout = useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase.from('workouts').update({ user_id: id }).eq('id', workoutId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const assignMealPlan = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from('meal_plans').update({ user_id: id }).eq('id', planId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  function Field({ label, value }: { label: string; value: string | number | null }) {
    return (
      <div>
        <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm text-[var(--text)]">{value ?? '—'}</p>
      </div>
    )
  }

  if (isLoading || !user) {
    return (
      <SlideOver open title="User Detail" onClose={() => navigate('/admin/users')}>
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
      </SlideOver>
    )
  }

  return (
    <SlideOver open title={user.full_name ?? user.email} onClose={() => navigate('/admin/users')}>
      <div className="flex flex-col gap-6">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge status={deriveStatus(user)} />
          {user.onboarding_complete && <span className="text-xs text-green-400">Onboarding complete</span>}
        </div>

        {/* Profile info */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name"  value={user.full_name} />
          <Field label="Email"      value={user.email} />
          <Field label="Age"        value={user.age} />
          <Field label="Height"     value={user.height_cm ? `${user.height_cm} cm` : null} />
          <Field label="Weight"     value={user.weight_kg ? `${user.weight_kg} kg` : null} />
          <Field label="Goal"       value={user.goal ? GOAL_LABELS[user.goal] : null} />
          <Field label="Activity"   value={user.activity_level ? ACTIVITY_LABELS[user.activity_level] : null} />
          <Field label="Joined"     value={new Date(user.created_at).toLocaleDateString()} />
        </div>

        {/* Assign workout plan */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Assign Workout Plan</p>
          <select
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none"
            defaultValue=""
            onChange={e => { if (e.target.value) assignWorkout.mutate(e.target.value) }}
          >
            <option value="" disabled>Select a plan…</option>
            {workoutPlans.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Assign meal plan */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Assign Meal Plan</p>
          <select
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none"
            defaultValue=""
            onChange={e => { if (e.target.value) assignMealPlan.mutate(e.target.value) }}
          >
            <option value="" disabled>Select a plan…</option>
            {mealPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Weight history */}
        {weightHistory.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Weight History</p>
            <div className="flex flex-col gap-1">
              {weightHistory.map(e => (
                <div key={e.id} className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{e.recorded_at}</span>
                  <span className="text-[var(--text)] font-semibold">{e.weight_kg} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin notes */}
        <div>
          <Input
            label="Admin Notes"
            value={adminNotes || user.admin_notes || ''}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder="Private notes about this user…"
          />
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => updateProfile.mutate({ admin_notes: adminNotes })}
            loading={updateProfile.isPending}
          >
            Save notes
          </Button>
        </div>

        {/* Block / Unblock */}
        <Button
          variant={user.is_blocked ? 'ghost' : 'danger'}
          className="w-full"
          onClick={() => updateProfile.mutate({ is_blocked: !user.is_blocked })}
          loading={updateProfile.isPending}
        >
          {user.is_blocked ? 'Unblock user' : 'Block user'}
        </Button>
      </div>
    </SlideOver>
  )
}
```

- [ ] **Step 3: Wire Users and UserDetail into App.tsx**

```tsx
// In admin/src/App.tsx replace placeholder functions with imports:
import Users from './pages/admin/Users'
import UserDetail from './pages/admin/UserDetail'
```

- [ ] **Step 4: Run tests**

```bash
cd admin && npm test
```

Expected: All previous tests PASS.

- [ ] **Step 5: Commit**

```bash
git add admin/src/pages/admin/Users.tsx admin/src/pages/admin/UserDetail.tsx admin/src/App.tsx
git commit -m "feat(admin): users list with search + user detail slide-over (assign plans, block, notes)"
```

---

## Task 12: Workouts Tab

**Files:**
- Create: `admin/src/pages/admin/Workouts.tsx`
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Create Workouts page**

```tsx
// admin/src/pages/admin/Workouts.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Input, Modal, Table, Th, Td } from '../../components/ui'
import type { Workout, WorkoutExercise } from '../../types/database'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type WorkoutWithCount = Workout & { exercise_count: number }

function useWorkouts() {
  return useQuery<WorkoutWithCount[]>({
    queryKey: ['workouts-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('workouts')
        .select('*, workout_exercises(id)')
        .order('name')
      return (data ?? []).map(w => ({
        ...w,
        exercise_count: (w.workout_exercises as { id: string }[]).length,
      }))
    },
  })
}

function useWorkoutExercises(workoutId: string | null) {
  return useQuery<WorkoutExercise[]>({
    queryKey: ['workout-exercises', workoutId],
    enabled: !!workoutId,
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_exercises')
        .select('*')
        .eq('workout_id', workoutId!)
        .order('sort_order')
      return data ?? []
    },
  })
}

type ExerciseDraft = Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at' | 'wger_exercise_id'>

const blankExercise = (): ExerciseDraft => ({
  name: '', muscle_group: '', sets: 3, reps: '10', rest_seconds: 60, tips: '', sort_order: 0,
})

interface WorkoutFormState {
  name: string
  day_of_week: number | null
  notes: string
  is_active: boolean
}

export default function Workouts() {
  const qc = useQueryClient()
  const { data: workouts = [], isLoading } = useWorkouts()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Workout | null>(null)
  const [form, setForm] = useState<WorkoutFormState>({ name: '', day_of_week: null, notes: '', is_active: true })
  const [exercises, setExercises] = useState<ExerciseDraft[]>([blankExercise()])

  const { data: existingExercises } = useWorkoutExercises(editing?.id ?? null)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', day_of_week: null, notes: '', is_active: true })
    setExercises([blankExercise()])
    setEditorOpen(true)
  }

  function openEdit(w: Workout) {
    setEditing(w)
    setForm({ name: w.name, day_of_week: w.day_of_week, notes: w.notes ?? '', is_active: w.is_active })
    setExercises(existingExercises?.map(e => ({
      name: e.name, muscle_group: e.muscle_group ?? '', sets: e.sets, reps: e.reps,
      rest_seconds: e.rest_seconds, tips: e.tips ?? '', sort_order: e.sort_order,
    })) ?? [blankExercise()])
    setEditorOpen(true)
  }

  const saveWorkout = useMutation({
    mutationFn: async () => {
      if (editing) {
        // Update workout
        await supabase.from('workouts').update({ ...form }).eq('id', editing.id)
        // Delete old exercises and reinsert
        await supabase.from('workout_exercises').delete().eq('workout_id', editing.id)
        if (exercises.length) {
          await supabase.from('workout_exercises').insert(
            exercises.map((e, i) => ({ ...e, workout_id: editing.id, sort_order: i }))
          )
        }
      } else {
        // Create workout
        const { data: w, error } = await supabase
          .from('workouts')
          .insert({ ...form })
          .select()
          .single()
        if (error) throw error
        if (exercises.length) {
          await supabase.from('workout_exercises').insert(
            exercises.map((e, i) => ({ ...e, workout_id: w.id, sort_order: i }))
          )
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts-admin'] })
      setEditorOpen(false)
    },
  })

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('workouts').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts-admin'] }),
  })

  function updateExercise(i: number, field: keyof ExerciseDraft, value: string | number) {
    setExercises(ex => ex.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function removeExercise(i: number) {
    setExercises(ex => ex.filter((_, idx) => idx !== i))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-[var(--text)]">Workouts</h1>
        <Button onClick={openCreate}>+ Create plan</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Day</Th>
              <Th>Exercises</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {workouts.map(w => (
              <tr key={w.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="text-[var(--text)] font-semibold">{w.name}</Td>
                <Td>{w.day_of_week !== null ? DAYS[w.day_of_week] : 'Any day'}</Td>
                <Td>{w.exercise_count} exercises</Td>
                <Td>{w.is_active ? <span className="text-green-400 text-xs">Active</span> : <span className="text-[var(--text-disabled)] text-xs">Inactive</span>}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(w)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => { if (confirm('Delete this workout?')) deleteWorkout.mutate(w.id) }} className="text-xs text-red-400 hover:text-red-300 bg-transparent border-0 cursor-pointer">Delete</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Editor Modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Edit Workout Plan' : 'New Workout Plan'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveWorkout.mutate()} loading={saveWorkout.isPending} disabled={!form.name}>
              {editing ? 'Save changes' : 'Create plan'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Plan name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Push/Pull/Legs" required />

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Day of week</label>
            <select
              className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none"
              value={form.day_of_week ?? ''}
              onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value === '' ? null : Number(e.target.value) }))}
            >
              <option value="">Any day</option>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>

          <Input label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes for the user" />

          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>

          {/* Exercises */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Exercises</p>
            {exercises.map((ex, i) => (
              <div key={i} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 mb-2">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Input label="Exercise name" value={ex.name} onChange={e => updateExercise(i, 'name', e.target.value)} placeholder="e.g. Bench Press" />
                  <Input label="Muscle group" value={ex.muscle_group ?? ''} onChange={e => updateExercise(i, 'muscle_group', e.target.value)} placeholder="e.g. Chest" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Input label="Sets" type="number" value={String(ex.sets)} onChange={e => updateExercise(i, 'sets', Number(e.target.value))} />
                  <Input label="Reps" value={ex.reps} onChange={e => updateExercise(i, 'reps', e.target.value)} placeholder="e.g. 10 or 8-12" />
                  <Input label="Rest (sec)" type="number" value={String(ex.rest_seconds)} onChange={e => updateExercise(i, 'rest_seconds', Number(e.target.value))} />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><Input label="Tips" value={ex.tips ?? ''} onChange={e => updateExercise(i, 'tips', e.target.value)} placeholder="Optional coaching tips" /></div>
                  <button onClick={() => removeExercise(i)} className="text-xs text-red-400 hover:text-red-300 bg-transparent border-0 cursor-pointer pb-2">Remove</button>
                </div>
              </div>
            ))}
            <button
              onClick={() => setExercises(ex => [...ex, { ...blankExercise(), sort_order: ex.length }])}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer"
            >
              + Add exercise
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 2: Wire Workouts into App.tsx**

```tsx
// In admin/src/App.tsx:
import Workouts from './pages/admin/Workouts'
```

- [ ] **Step 3: Run tests**

```bash
cd admin && npm test
```

Expected: All previous tests PASS.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/admin/Workouts.tsx admin/src/App.tsx
git commit -m "feat(admin): workouts tab — plan list, create/edit workout with exercise builder"
```

---

## Task 13: Nutrition Tab — Recipes + Meal Plans

**Files:**
- Create: `admin/src/pages/admin/Nutrition.tsx`
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Create Nutrition page with sub-tabs**

```tsx
// admin/src/pages/admin/Nutrition.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Input, Modal, Table, Th, Td } from '../../components/ui'
import type { Recipe, RecipeIngredient, MealPlan, Meal, MealPlanRecipe } from '../../types/database'

// ─── Recipes ────────────────────────────────────────────────────────────────

type IngredientDraft = Omit<RecipeIngredient, 'id' | 'recipe_id'>

const blankIngredient = (i: number): IngredientDraft => ({
  name: '', quantity: null, unit: '', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sort_order: i,
})

function calcMacros(ingredients: IngredientDraft[]) {
  return ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein_g: acc.protein_g + ing.protein_g,
      carbs_g: acc.carbs_g + ing.carbs_g,
      fat_g: acc.fat_g + ing.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}

function useRecipes() {
  return useQuery<Recipe[]>({
    queryKey: ['recipes-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('recipes').select('*').order('name')
      return data ?? []
    },
  })
}

function RecipesTab() {
  const qc = useQueryClient()
  const { data: recipes = [], isLoading } = useRecipes()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [form, setForm] = useState({ name: '', description: '', prep_time_min: '', servings: '1' })
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([blankIngredient(0)])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', prep_time_min: '', servings: '1' })
    setIngredients([blankIngredient(0)])
    setEditorOpen(true)
  }

  async function openEdit(r: Recipe) {
    setEditing(r)
    setForm({ name: r.name, description: r.description ?? '', prep_time_min: String(r.prep_time_min ?? ''), servings: String(r.servings) })
    const { data } = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', r.id).order('sort_order')
    setIngredients(data?.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit ?? '', calories: i.calories, protein_g: i.protein_g, carbs_g: i.carbs_g, fat_g: i.fat_g, sort_order: i.sort_order })) ?? [blankIngredient(0)])
    setEditorOpen(true)
  }

  const saveRecipe = useMutation({
    mutationFn: async () => {
      const macros = calcMacros(ingredients)
      const payload = {
        name: form.name,
        description: form.description || null,
        prep_time_min: form.prep_time_min ? Number(form.prep_time_min) : null,
        servings: Number(form.servings),
        ...macros,
      }
      if (editing) {
        await supabase.from('recipes').update(payload).eq('id', editing.id)
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', editing.id)
        if (ingredients.length) {
          await supabase.from('recipe_ingredients').insert(ingredients.map((ing, i) => ({ ...ing, recipe_id: editing.id, sort_order: i })))
        }
      } else {
        const { data: r, error } = await supabase.from('recipes').insert(payload).select().single()
        if (error) throw error
        if (ingredients.length) {
          await supabase.from('recipe_ingredients').insert(ingredients.map((ing, i) => ({ ...ing, recipe_id: r.id, sort_order: i })))
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recipes-admin'] }); setEditorOpen(false) },
  })

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => { await supabase.from('recipes').delete().eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes-admin'] }),
  })

  function updateIngredient(i: number, field: keyof IngredientDraft, value: string | number | null) {
    setIngredients(ings => ings.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing))
  }

  const macros = calcMacros(ingredients)

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-muted)]">{recipes.length} recipes in library</p>
        <Button onClick={openCreate}>+ Add recipe</Button>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th><Th>Calories</Th><Th>Protein</Th><Th>Carbs</Th><Th>Fat</Th><Th>Prep</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {recipes.map(r => (
              <tr key={r.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="text-[var(--text)] font-semibold">{r.name}</Td>
                <Td>{Math.round(r.calories)} kcal</Td>
                <Td>{r.protein_g.toFixed(1)}g</Td>
                <Td>{r.carbs_g.toFixed(1)}g</Td>
                <Td>{r.fat_g.toFixed(1)}g</Td>
                <Td>{r.prep_time_min ? `${r.prep_time_min} min` : '—'}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(r)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => { if (confirm('Delete this recipe?')) deleteRecipe.mutate(r.id) }} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer">Delete</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Edit Recipe' : 'New Recipe'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveRecipe.mutate()} loading={saveRecipe.isPending} disabled={!form.name}>
              {editing ? 'Save changes' : 'Add recipe'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Recipe name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Overnight Oats" required />
          <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prep time (min)" type="number" value={form.prep_time_min} onChange={e => setForm(f => ({ ...f, prep_time_min: e.target.value }))} />
            <Input label="Servings" type="number" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))} />
          </div>

          {/* Macro summary */}
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 grid grid-cols-4 gap-2 text-center">
            {[['Calories', `${Math.round(macros.calories)} kcal`], ['Protein', `${macros.protein_g.toFixed(1)}g`], ['Carbs', `${macros.carbs_g.toFixed(1)}g`], ['Fat', `${macros.fat_g.toFixed(1)}g`]].map(([label, val]) => (
              <div key={label}>
                <p className="text-[9px] text-[var(--text-disabled)] uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-[var(--text)]">{val}</p>
              </div>
            ))}
          </div>

          {/* Ingredients */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Ingredients</p>
            {ingredients.map((ing, i) => (
              <div key={i} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 mb-2">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Input label="Name" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} placeholder="e.g. Oats" />
                  <Input label="Quantity" type="number" value={String(ing.quantity ?? '')} onChange={e => updateIngredient(i, 'quantity', e.target.value ? Number(e.target.value) : null)} />
                  <Input label="Unit" value={ing.unit ?? ''} onChange={e => updateIngredient(i, 'unit', e.target.value)} placeholder="g, ml, tbsp" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Input label="Calories" type="number" value={String(ing.calories)} onChange={e => updateIngredient(i, 'calories', Number(e.target.value))} />
                  <Input label="Protein" type="number" value={String(ing.protein_g)} onChange={e => updateIngredient(i, 'protein_g', Number(e.target.value))} />
                  <Input label="Carbs" type="number" value={String(ing.carbs_g)} onChange={e => updateIngredient(i, 'carbs_g', Number(e.target.value))} />
                  <div className="flex gap-1 items-end">
                    <Input label="Fat" type="number" value={String(ing.fat_g)} onChange={e => updateIngredient(i, 'fat_g', Number(e.target.value))} />
                    <button onClick={() => setIngredients(ings => ings.filter((_, idx) => idx !== i))} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer pb-2">✕</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setIngredients(ings => [...ings, blankIngredient(ings.length)])} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">
              + Add ingredient
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Meal Plans ──────────────────────────────────────────────────────────────

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

function useMealPlans() {
  return useQuery<MealPlan[]>({
    queryKey: ['meal-plans-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('meal_plans').select('*').order('name')
      return data ?? []
    },
  })
}

interface MealDraft { name: string; time_of_day: string; recipes: { recipe_id: string; meal_type: string }[] }

function MealPlansTab() {
  const qc = useQueryClient()
  const { data: mealPlans = [], isLoading } = useMealPlans()
  const { data: recipes = [] } = useRecipes()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<MealPlan | null>(null)
  const [form, setForm] = useState({ name: '', description: '', valid_from: '', valid_to: '', is_active: true })
  const [meals, setMeals] = useState<MealDraft[]>([{ name: 'Breakfast', time_of_day: '08:00', recipes: [] }])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', valid_from: '', valid_to: '', is_active: true })
    setMeals([{ name: 'Breakfast', time_of_day: '08:00', recipes: [] }])
    setEditorOpen(true)
  }

  const savePlan = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        is_active: form.is_active,
      }
      let planId: string
      if (editing) {
        await supabase.from('meal_plans').update(payload).eq('id', editing.id)
        planId = editing.id
        // Rebuild meals: delete existing, re-insert
        const { data: existingMeals } = await supabase.from('meals').select('id').eq('meal_plan_id', planId)
        if (existingMeals) {
          for (const m of existingMeals) {
            await supabase.from('meal_plan_recipes').delete().eq('meal_id', m.id)
          }
          await supabase.from('meals').delete().eq('meal_plan_id', planId)
        }
      } else {
        const { data: plan, error } = await supabase.from('meal_plans').insert(payload).select().single()
        if (error) throw error
        planId = plan.id
      }
      for (let i = 0; i < meals.length; i++) {
        const { data: meal, error: mErr } = await supabase
          .from('meals')
          .insert({ meal_plan_id: planId, name: meals[i].name, time_of_day: meals[i].time_of_day || null, sort_order: i })
          .select()
          .single()
        if (mErr) throw mErr
        if (meals[i].recipes.length) {
          await supabase.from('meal_plan_recipes').insert(
            meals[i].recipes.map(r => ({ meal_plan_id: planId, meal_id: meal.id, recipe_id: r.recipe_id, meal_type: r.meal_type || null }))
          )
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meal-plans-admin'] }); setEditorOpen(false) },
  })

  const deletePlan = useMutation({
    mutationFn: async (id: string) => { await supabase.from('meal_plans').delete().eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans-admin'] }),
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-muted)]">{mealPlans.length} meal plans</p>
        <Button onClick={openCreate}>+ Create meal plan</Button>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : (
        <Table>
          <thead>
            <tr><Th>Name</Th><Th>Valid from</Th><Th>Valid to</Th><Th>Status</Th><Th></Th></tr>
          </thead>
          <tbody>
            {mealPlans.map(p => (
              <tr key={p.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="text-[var(--text)] font-semibold">{p.name}</Td>
                <Td>{p.valid_from ?? '—'}</Td>
                <Td>{p.valid_to ?? '—'}</Td>
                <Td>{p.is_active ? <span className="text-green-400 text-xs">Active</span> : <span className="text-[var(--text-disabled)] text-xs">Inactive</span>}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(p); setForm({ name: p.name, description: p.description ?? '', valid_from: p.valid_from ?? '', valid_to: p.valid_to ?? '', is_active: p.is_active }); setEditorOpen(true) }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => { if (confirm('Delete this meal plan?')) deletePlan.mutate(p.id) }} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer">Delete</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Edit Meal Plan' : 'New Meal Plan'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => savePlan.mutate()} loading={savePlan.isPending} disabled={!form.name}>
              {editing ? 'Save changes' : 'Create plan'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Plan name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valid from" type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
            <Input label="Valid to" type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>

          {/* Meal slots */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Meal Slots</p>
            {meals.map((meal, mi) => (
              <div key={mi} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 mb-2">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Input label="Meal name" value={meal.name} onChange={e => setMeals(ms => ms.map((m, i) => i === mi ? { ...m, name: e.target.value } : m))} placeholder="e.g. Breakfast" />
                  <Input label="Time" type="time" value={meal.time_of_day} onChange={e => setMeals(ms => ms.map((m, i) => i === mi ? { ...m, time_of_day: e.target.value } : m))} />
                </div>
                {/* Recipe picker */}
                <div className="flex gap-2 items-center">
                  <select
                    className="flex-1 bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text)] outline-none"
                    defaultValue=""
                    onChange={e => {
                      if (!e.target.value) return
                      setMeals(ms => ms.map((m, i) => i === mi ? { ...m, recipes: [...m.recipes, { recipe_id: e.target.value, meal_type: 'breakfast' }] } : m))
                      e.target.value = ''
                    }}
                  >
                    <option value="" disabled>Add recipe…</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button onClick={() => setMeals(ms => ms.filter((_, i) => i !== mi))} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer">Remove slot</button>
                </div>
                {meal.recipes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {meal.recipes.map((r, ri) => {
                      const recipe = recipes.find(rec => rec.id === r.recipe_id)
                      return (
                        <span key={ri} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-card)] border border-[var(--border)] rounded text-xs text-[var(--text-muted)]">
                          {recipe?.name ?? r.recipe_id}
                          <button onClick={() => setMeals(ms => ms.map((m, i) => i === mi ? { ...m, recipes: m.recipes.filter((_, j) => j !== ri) } : m))} className="text-[var(--text-disabled)] hover:text-red-400 bg-transparent border-0 cursor-pointer">✕</button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setMeals(ms => [...ms, { name: '', time_of_day: '', recipes: [] }])} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">
              + Add meal slot
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Nutrition root (sub-tabs) ───────────────────────────────────────────────

export default function Nutrition() {
  const [activeTab, setActiveTab] = useState<'recipes' | 'meal-plans'>('recipes')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-[var(--text)]">Nutrition</h1>
      </div>
      <div className="flex gap-0 mb-6 border-b border-[var(--border)]">
        {(['recipes', 'meal-plans'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px cursor-pointer bg-transparent transition-colors capitalize ${
              activeTab === tab
                ? 'border-[var(--text)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab === 'recipes' ? 'Recipes' : 'Meal Plans'}
          </button>
        ))}
      </div>
      {activeTab === 'recipes' ? <RecipesTab /> : <MealPlansTab />}
    </div>
  )
}
```

- [ ] **Step 2: Wire Nutrition into App.tsx**

```tsx
// In admin/src/App.tsx:
import Nutrition from './pages/admin/Nutrition'
```

- [ ] **Step 3: Run tests**

```bash
cd admin && npm test
```

Expected: All previous tests PASS.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/admin/Nutrition.tsx admin/src/App.tsx
git commit -m "feat(admin): nutrition tab — recipes library with macros + meal plan builder"
```

---

## Task 14: Quotes Tab

**Files:**
- Create: `admin/src/pages/admin/Quotes.tsx`
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Write failing test for quote activation logic**

```typescript
// admin/src/pages/admin/Quotes.test.ts
import { describe, it, expect } from 'vitest'

// The rule: setting a quote active must deactivate all others.
// We test the pure transformation — the mutation that wraps this is tested via integration.
function applyActiveQuote(quotes: { id: string; is_active: boolean }[], activeId: string) {
  return quotes.map(q => ({ ...q, is_active: q.id === activeId }))
}

describe('quote activation', () => {
  it('sets only the selected quote as active', () => {
    const quotes = [
      { id: '1', is_active: true },
      { id: '2', is_active: false },
      { id: '3', is_active: false },
    ]
    const result = applyActiveQuote(quotes, '2')
    expect(result.find(q => q.id === '1')?.is_active).toBe(false)
    expect(result.find(q => q.id === '2')?.is_active).toBe(true)
    expect(result.find(q => q.id === '3')?.is_active).toBe(false)
  })

  it('deactivates all when given an id that does not exist', () => {
    const quotes = [{ id: '1', is_active: true }]
    const result = applyActiveQuote(quotes, 'nonexistent')
    expect(result.every(q => !q.is_active)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd admin && npm test
```

Expected: FAIL — `applyActiveQuote` not defined.

- [ ] **Step 3: Create Quotes page (exports applyActiveQuote for testing)**

```tsx
// admin/src/pages/admin/Quotes.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Input, Modal, Table, Th, Td } from '../../components/ui'
import type { DailyQuote } from '../../types/database'

// Exported for unit testing
export function applyActiveQuote(
  quotes: { id: string; is_active: boolean }[],
  activeId: string
) {
  return quotes.map(q => ({ ...q, is_active: q.id === activeId }))
}

function useQuotes() {
  return useQuery<DailyQuote[]>({
    queryKey: ['quotes-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_quotes')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })
}

export default function Quotes() {
  const qc = useQueryClient()
  const { data: quotes = [], isLoading } = useQuotes()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<DailyQuote | null>(null)
  const [form, setForm] = useState({ text: '', author: '', scheduled_date: '' })

  function openCreate() {
    setEditing(null)
    setForm({ text: '', author: '', scheduled_date: '' })
    setEditorOpen(true)
  }

  function openEdit(q: DailyQuote) {
    setEditing(q)
    setForm({ text: q.text, author: q.author ?? '', scheduled_date: q.scheduled_date ?? '' })
    setEditorOpen(true)
  }

  const saveQuote = useMutation({
    mutationFn: async () => {
      const payload = {
        text: form.text,
        author: form.author || null,
        scheduled_date: form.scheduled_date || null,
      }
      if (editing) {
        const { error } = await supabase.from('daily_quotes').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('daily_quotes').insert({ ...payload, is_active: false })
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes-admin'] }); setEditorOpen(false) },
  })

  const setActive = useMutation({
    mutationFn: async (id: string) => {
      // Deactivate all, then activate the chosen one — two-step to avoid race conditions
      const { error: err1 } = await supabase
        .from('daily_quotes')
        .update({ is_active: false })
        .neq('id', id)
      if (err1) throw err1
      const { error: err2 } = await supabase
        .from('daily_quotes')
        .update({ is_active: true })
        .eq('id', id)
      if (err2) throw err2
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes-admin'] })
      qc.invalidateQueries({ queryKey: ['active-quote'] })
    },
  })

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('daily_quotes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes-admin'] }),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-[var(--text)]">Quotes</h1>
        <Button onClick={openCreate}>+ Add quote</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
      ) : (
        <Table>
          <thead>
            <tr><Th>Quote</Th><Th>Author</Th><Th>Scheduled</Th><Th>Status</Th><Th></Th></tr>
          </thead>
          <tbody>
            {quotes.map(q => (
              <tr key={q.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="max-w-xs">
                  <p className="text-sm text-[var(--text)] truncate">{q.text}</p>
                </Td>
                <Td>{q.author ?? '—'}</Td>
                <Td>{q.scheduled_date ?? '—'}</Td>
                <Td>
                  {q.is_active
                    ? <span className="text-green-400 text-xs font-semibold">● Active</span>
                    : <span className="text-[var(--text-disabled)] text-xs">Inactive</span>}
                </Td>
                <Td>
                  <div className="flex gap-2 flex-wrap">
                    {!q.is_active && (
                      <button
                        onClick={() => setActive.mutate(q.id)}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border border-[var(--border)] rounded px-2 py-0.5 cursor-pointer"
                      >
                        Set active
                      </button>
                    )}
                    <button onClick={() => openEdit(q)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">Edit</button>
                    <button
                      onClick={() => { if (confirm('Delete this quote?')) deleteQuote.mutate(q.id) }}
                      className="text-xs text-red-400 bg-transparent border-0 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Edit Quote' : 'New Quote'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveQuote.mutate()} loading={saveQuote.isPending} disabled={!form.text}>
              {editing ? 'Save changes' : 'Add quote'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Quote text</label>
            <textarea
              className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--text-muted)] resize-none"
              rows={4}
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              placeholder="Enter the quote text…"
            />
          </div>
          <Input label="Author" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="e.g. Coach Foska" />
          <Input label="Scheduled date (optional)" type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 4: Update the test file to import from Quotes.tsx**

```typescript
// admin/src/pages/admin/Quotes.test.ts
import { describe, it, expect } from 'vitest'
import { applyActiveQuote } from './Quotes'

describe('quote activation', () => {
  it('sets only the selected quote as active', () => {
    const quotes = [
      { id: '1', is_active: true },
      { id: '2', is_active: false },
      { id: '3', is_active: false },
    ]
    const result = applyActiveQuote(quotes, '2')
    expect(result.find(q => q.id === '1')?.is_active).toBe(false)
    expect(result.find(q => q.id === '2')?.is_active).toBe(true)
    expect(result.find(q => q.id === '3')?.is_active).toBe(false)
  })

  it('deactivates all when given an id that does not exist', () => {
    const quotes = [{ id: '1', is_active: true }]
    const result = applyActiveQuote(quotes, 'nonexistent')
    expect(result.every(q => !q.is_active)).toBe(true)
  })
})
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd admin && npm test
```

Expected: All tests PASS including the 2 new Quotes tests.

- [ ] **Step 6: Wire Quotes into App.tsx**

In `admin/src/App.tsx`, add the import and remove the `function Quotes()` placeholder:

```tsx
// Add at top with other admin page imports:
import Quotes from './pages/admin/Quotes'

// Remove the placeholder: function Quotes() { return <div ...>Quotes</div> }
// The route already uses <Quotes /> — no route change needed.
```

- [ ] **Step 7: Final test run**

```bash
cd admin && npm test
```

Expected: All tests PASS. Check final count:
- useTheme: 4
- useAuth: 2
- Button: 4
- RouteGuard: 4
- Quotes: 2
- Total: 16 tests PASS

- [ ] **Step 8: Build and verify no TypeScript errors**

```bash
cd admin && npm run build
```

Expected: Build succeeds with no TypeScript errors, `dist/` folder created.

- [ ] **Step 9: Commit**

```bash
git add admin/src/pages/admin/Quotes.tsx admin/src/pages/admin/Quotes.test.ts admin/src/App.tsx
git commit -m "feat(admin): quotes tab — list, create/edit, set active (deactivates others)"
```

---

## Task 15: Final Polish + Netlify Ready

**Files:**
- Create: `admin/public/favicon.svg`
- Verify: `admin/netlify.toml` build config

- [ ] **Step 1: Add a minimal favicon**

```svg
<!-- admin/public/favicon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#000"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#fff" font-size="16" font-family="system-ui" font-weight="800">CF</text>
</svg>
```

- [ ] **Step 2: Verify full build passes**

```bash
cd admin && npm run build
```

Expected: No errors. `dist/` contains `index.html`, assets.

- [ ] **Step 3: Preview the production build locally**

```bash
cd admin && npm run preview
```

Open `http://localhost:4173` — verify landing page loads, routing works.

- [ ] **Step 4: Run full test suite one final time**

```bash
cd admin && npm test
```

Expected: 16 tests PASS, 0 failures.

- [ ] **Step 5: Final commit**

```bash
git add admin/public/ admin/
git commit -m "feat(admin): final polish — favicon, verified production build"
```

---

## Deployment Checklist

Before deploying to Netlify:

1. Set environment variables in Netlify dashboard:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key

2. Connect the repo to Netlify and set base directory to `admin`.

3. Netlify will auto-detect `netlify.toml` and use `npm run build` with `dist` as publish dir.

4. After first deploy, verify CSP headers are present:
   ```bash
   curl -I https://your-site.netlify.app | grep Content-Security-Policy
   ```
