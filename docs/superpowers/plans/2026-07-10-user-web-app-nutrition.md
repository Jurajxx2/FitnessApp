# User Web App (Nutrition MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first, user-facing web app for Coach Foska's clients whose first slice is the Nutrition section (view meal plan + recipes + daily macro summary + history, and log meals), styled to match the mobile app.

**Architecture:** A brand-new, independent Vite + React + TypeScript app in a new `webapp/` folder, on the same stack as the existing `admin/` app. It talks directly to the existing Supabase backend via `supabase-js` + TanStack Query — **no backend/schema/RLS changes**. All queries mirror the KMP `MealRemoteDataSource`; RLS already scopes every row to the signed-in user. A web design-token layer (CSS variables + Tailwind theme) mirrors the mobile `designsystem` module 1:1.

**Tech Stack:** React 19, Vite 6, TypeScript ~5.8, Tailwind CSS 4 (`@tailwindcss/vite`), `@supabase/supabase-js` ^2, `@tanstack/react-query` ^5, `react-router-dom` ^7, `framer-motion` ^12, `lucide-react`, Vitest + `@testing-library/react` + jsdom.

**Reference spec:** `docs/superpowers/specs/2026-07-10-user-web-app-nutrition-design.md`.

## Global Constraints

- **Location:** all new code lives under `webapp/` (sibling to `admin/`). Do not modify `admin/` or `composeApp/`.
- **No backend changes:** no SQL migrations, no RLS edits, no edge functions. Reads/writes use existing tables only.
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (identical names to `admin/`).
- **Design tokens only:** components read semantic token classes (`bg-surface`, `text-primary`, `bg-accent`, …) — never raw hex. Palette/type values are fixed by the spec §4.
- **Theme:** light + dark via `prefers-color-scheme` only. No runtime toggle.
- **Auth:** email OTP only. No Google/Apple.
- **Scope:** Nutrition section only. No workouts/home/profile tabs, no photo analysis, no barcode.
- **Package manager:** `npm`. Run all commands from `webapp/` unless stated. `cd webapp` first.
- **Git:** stage explicit paths in every commit (never `git add -A`/`.`). Execute this plan on a feature branch or git worktree (see superpowers:using-git-worktrees).
- **Column-name truth (snake_case):** recipes use `photo_url`, `prep_time_min`, `cook_time_min`, `featured`. `meal_log_foods` inserts must populate BOTH `amount`+`unit` AND `amount_grams`. `meal_plans` filtered by `is_active = true`; `meals` have `day_of_week` (0=Mon…6=Sun, null = every day).

---

### Task 1: Scaffold the `webapp/` project

Creates an independent Vite React-TS app with Tailwind 4, Vitest, and deploy config. Deliverable: `npm run build` and `npm test` pass with a smoke test.

**Files:**
- Create: `webapp/package.json`, `webapp/vite.config.ts`, `webapp/tsconfig.json`, `webapp/tsconfig.app.json`, `webapp/tsconfig.node.json`, `webapp/index.html`, `webapp/netlify.toml`, `webapp/.env.example`, `webapp/.gitignore`, `webapp/src/vite-env.d.ts`, `webapp/src/main.tsx`, `webapp/src/App.tsx`, `webapp/src/index.css`, `webapp/src/test-setup.ts`, `webapp/src/smoke.test.tsx`

**Interfaces:**
- Produces: an `App` default export (React component); npm scripts `dev`, `build`, `test`, `lint`.

- [ ] **Step 1: Create `webapp/package.json`**

```json
{
  "name": "coach-foska-webapp",
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
    "@supabase/supabase-js": "^2.49.4",
    "@tanstack/react-query": "^5.74.4",
    "framer-motion": "^12.40.0",
    "lucide-react": "^1.16.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.5.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.3",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.4.1",
    "@vitest/coverage-v8": "^3.1.1",
    "jsdom": "^26.1.0",
    "tailwindcss": "^4.1.3",
    "typescript": "~5.8.3",
    "vite": "^6.3.2",
    "vitest": "^3.1.1"
  }
}
```

- [ ] **Step 2: Create the config files**

`webapp/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    pool: 'forks',
    css: false,
  },
})
```

`webapp/tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`webapp/tsconfig.app.json`:
```json
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
    "noUncheckedSideEffectImports": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`webapp/tsconfig.node.json`:
```json
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

`webapp/index.html`:
```html
<!doctype html>
<html lang="sk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Coach Foska</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`webapp/netlify.toml`:
```toml
# webapp/netlify.toml
[build]
  base    = "webapp"
  publish = "dist"
  command = "npm run build"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options            = "DENY"
    X-Content-Type-Options     = "nosniff"
    Referrer-Policy            = "strict-origin-when-cross-origin"
    Permissions-Policy         = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy    = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; img-src 'self' data: https://*.supabase.co; frame-ancestors 'none';"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

`webapp/.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`webapp/.gitignore`:
```
node_modules
dist
.env
*.local
```

`webapp/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`webapp/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Create minimal app entry + a smoke component**

`webapp/src/index.css`:
```css
@import "tailwindcss";
```

`webapp/src/App.tsx`:
```tsx
export default function App() {
  return <div>Coach Foska</div>
}
```

`webapp/src/main.tsx`:
```tsx
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

- [ ] **Step 4: Write the failing smoke test**

`webapp/src/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app name', () => {
  render(<App />)
  expect(screen.getByText('Coach Foska')).toBeInTheDocument()
})
```

- [ ] **Step 5: Install deps and run the test**

```bash
cd webapp && npm install
npm test
```
Expected: 1 passing test.

- [ ] **Step 6: Verify production build**

Run: `npm run build`
Expected: build completes, `dist/` produced, no TS errors.

- [ ] **Step 7: Copy the `.env` values from admin so dev can run**

```bash
cp ../admin/.env .env
```
(Same Supabase project + anon key. If `../admin/.env` is absent, fill `.env` from `.env.example` using the values in the repo `local.properties`.)

- [ ] **Step 8: Commit**

```bash
cd .. && git add -f webapp/package.json webapp/package-lock.json webapp/vite.config.ts webapp/tsconfig.json webapp/tsconfig.app.json webapp/tsconfig.node.json webapp/index.html webapp/netlify.toml webapp/.env.example webapp/.gitignore webapp/src/vite-env.d.ts webapp/src/main.tsx webapp/src/App.tsx webapp/src/index.css webapp/src/test-setup.ts webapp/src/smoke.test.tsx
git commit -m "feat(webapp): scaffold Vite React user web app"
```
(Note: `docs/` and app folders may be covered by a blanket `.gitignore`; `-f` forces the intended files. `.env` stays ignored.)

---

### Task 2: Design-token layer (colors + type + shape/spacing)

Ports the Foska palette and type ramp into CSS variables + Tailwind v4 theme utilities. Deliverable: semantic utility classes (`bg-surface`, `text-primary`, `bg-accent`, `.ds-metric-lg`, …) resolve in both light and dark.

**Files:**
- Modify: `webapp/src/index.css`
- Create: `webapp/src/design/tokens.test.tsx`

**Interfaces:**
- Produces: Tailwind color utilities `background, surface, surface-elevated, surface-highest, text-primary, text-secondary, text-accent, accent, on-accent, action-primary, on-action-primary, action-secondary, on-action-secondary, success, warning, error, outline, outline-subtle`; CSS classes `.ds-metric-lg`, `.ds-metric-md`, `.ds-metric-sm`, `.ds-display-lg`.

- [ ] **Step 1: Replace `webapp/src/index.css` with the token layer**

```css
@import "tailwindcss";

/* Map semantic tokens -> Tailwind utilities. `inline` makes utilities read the
   CSS var at use-site, so prefers-color-scheme swaps propagate automatically. */
@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-highest: var(--surface-highest);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-accent: var(--text-accent);
  --color-accent: var(--accent);
  --color-on-accent: var(--on-accent);
  --color-action-primary: var(--action-primary);
  --color-on-action-primary: var(--on-action-primary);
  --color-action-secondary: var(--action-secondary);
  --color-on-action-secondary: var(--on-action-secondary);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-error: var(--error);
  --color-outline: var(--outline);
  --color-outline-subtle: var(--outline-subtle);
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
}

/* Light (default) — from FoskaBrand.lightColors */
:root {
  --background: #ffffff;
  --surface: #ffffff;
  --surface-elevated: #f5f5f5;
  --surface-highest: #eeeeee;
  --text-primary: #000000;
  --text-secondary: #757575;
  --text-accent: #cf2e2e;
  --accent: #a90707;
  --on-accent: #ffffff;
  --action-primary: #000000;
  --on-action-primary: #ffffff;
  --action-secondary: #f5f5f5;
  --on-action-secondary: #000000;
  --success: #2e7d32;
  --warning: #f9a825;
  --error: #cf2e2e;
  --outline: #e0e0e0;
  --outline-subtle: #eeeeee;
}

/* Dark — from FoskaBrand.darkColors */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #000000;
    --surface: #0f0f0f;
    --surface-elevated: #1a1a1a;
    --surface-highest: #32373c;
    --text-primary: #ffffff;
    --text-secondary: #bdbdbd;
    --text-accent: #cf2e2e;
    --accent: #a90707;
    --on-accent: #ffffff;
    --action-primary: #ffffff;
    --on-action-primary: #000000;
    --action-secondary: #1a1a1a;
    --on-action-secondary: #ffffff;
    --success: #2e7d32;
    --warning: #f9a825;
    --error: #cf2e2e;
    --outline: #444444;
    --outline-subtle: #32373c;
  }
}

body {
  background-color: var(--background);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Signature oversized metric styles — from DsTypography metric ramp. */
.ds-display-lg { font-size: 36px; line-height: 40px; font-weight: 800; letter-spacing: -1px; }
.ds-metric-lg  { font-size: 44px; line-height: 48px; font-weight: 800; letter-spacing: -1.5px; }
.ds-metric-md  { font-size: 28px; line-height: 32px; font-weight: 800; letter-spacing: -0.5px; }
.ds-metric-sm  { font-size: 18px; line-height: 22px; font-weight: 700; letter-spacing: 0; }
```

- [ ] **Step 2: Write a test that a token-styled element renders**

`webapp/src/design/tokens.test.tsx`:
```tsx
import { render } from '@testing-library/react'

test('semantic token utility classes apply without error', () => {
  const { container } = render(
    <div className="bg-surface text-primary">
      <span className="ds-metric-lg text-accent">1234</span>
    </div>
  )
  expect(container.querySelector('.ds-metric-lg')).toBeInTheDocument()
  expect(container.querySelector('.bg-surface')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test**

Run: `cd webapp && npm test -- src/design/tokens.test.tsx`
Expected: PASS.

- [ ] **Step 4: Verify build still compiles Tailwind**

Run: `npm run build`
Expected: PASS (Tailwind processes `@theme`).

- [ ] **Step 5: Commit**

```bash
cd .. && git add -f webapp/src/index.css webapp/src/design/tokens.test.tsx
git commit -m "feat(webapp): Foska design-token layer (colors, type, radius)"
```

---

### Task 3: Core UI primitives

Presentational primitives on the token layer. Deliverable: `Button`, `Card`, `Input`, `Chip`, `SectionHeader`, `EmptyState`, `Shimmer` render with token classes.

**Files:**
- Create: `webapp/src/lib/cn.ts`, `webapp/src/components/ui/Button.tsx`, `webapp/src/components/ui/Card.tsx`, `webapp/src/components/ui/Input.tsx`, `webapp/src/components/ui/Chip.tsx`, `webapp/src/components/ui/SectionHeader.tsx`, `webapp/src/components/ui/EmptyState.tsx`, `webapp/src/components/ui/Shimmer.tsx`, `webapp/src/components/ui/index.ts`, `webapp/src/components/ui/primitives.test.tsx`

**Interfaces:**
- Produces:
  - `cn(...classes: (string | false | null | undefined)[]): string`
  - `Button(props: { variant?: 'primary' | 'secondary'; loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>)`
  - `Card(props: React.HTMLAttributes<HTMLDivElement>)`
  - `Input(props: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>)`
  - `Chip(props: { selected?: boolean; onClick?: () => void; children: React.ReactNode })`
  - `SectionHeader(props: { title: string; action?: React.ReactNode })`
  - `EmptyState(props: { icon?: React.ReactNode; title: string; message?: string })`
  - `Shimmer(props: { className?: string })`

- [ ] **Step 1: Create the `cn` helper**

`webapp/src/lib/cn.ts`:
```ts
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
```

- [ ] **Step 2: Create the primitives**

`webapp/src/components/ui/Button.tsx`:
```tsx
import React from 'react'
import { cn } from '../../lib/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl text-sm font-semibold',
        'transition-opacity disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-action-primary text-on-action-primary',
        variant === 'secondary' && 'bg-action-secondary text-on-action-secondary',
        className,
      )}
    >
      {loading ? '…' : children}
    </button>
  )
}
```

`webapp/src/components/ui/Card.tsx`:
```tsx
import React from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('bg-surface-elevated rounded-2xl p-4 border border-outline-subtle', className)} />
}
```

`webapp/src/components/ui/Input.tsx`:
```tsx
import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, ...rest }: InputProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <input
        id={id}
        {...rest}
        className="h-12 px-3 rounded-xl bg-surface-elevated border border-outline text-text-primary
                   outline-none focus:border-text-secondary placeholder:text-text-secondary"
      />
    </label>
  )
}
```

`webapp/src/components/ui/Chip.tsx`:
```tsx
import React from 'react'
import { cn } from '../../lib/cn'

export function Chip({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 h-9 rounded-full text-sm font-medium border transition-colors',
        selected ? 'bg-action-primary text-on-action-primary border-transparent'
                 : 'bg-surface text-text-secondary border-outline',
      )}
    >
      {children}
    </button>
  )
}
```

`webapp/src/components/ui/SectionHeader.tsx`:
```tsx
import React from 'react'

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      {action}
    </div>
  )
}
```

`webapp/src/components/ui/EmptyState.tsx`:
```tsx
import React from 'react'

export function EmptyState({ icon, title, message }: { icon?: React.ReactNode; title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-12 px-6">
      {icon && <div className="text-text-secondary">{icon}</div>}
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {message && <p className="text-sm text-text-secondary">{message}</p>}
    </div>
  )
}
```

`webapp/src/components/ui/Shimmer.tsx`:
```tsx
import { cn } from '../../lib/cn'

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-surface-highest rounded-lg', className)} />
}
```

`webapp/src/components/ui/index.ts`:
```ts
export { Button } from './Button'
export { Card } from './Card'
export { Input } from './Input'
export { Chip } from './Chip'
export { SectionHeader } from './SectionHeader'
export { EmptyState } from './EmptyState'
export { Shimmer } from './Shimmer'
```

- [ ] **Step 3: Write render tests**

`webapp/src/components/ui/primitives.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, Chip, Input, SectionHeader, EmptyState } from './index'

test('Button disables when loading', () => {
  render(<Button loading>Save</Button>)
  expect(screen.getByRole('button')).toBeDisabled()
})

test('Chip fires onClick', async () => {
  const onClick = vi.fn()
  render(<Chip onClick={onClick}>All</Chip>)
  await userEvent.click(screen.getByRole('button', { name: 'All' }))
  expect(onClick).toHaveBeenCalledOnce()
})

test('Input renders its label', () => {
  render(<Input id="email" label="Email address" />)
  expect(screen.getByText('Email address')).toBeInTheDocument()
})

test('SectionHeader + EmptyState render text', () => {
  render(<><SectionHeader title="Recipes" /><EmptyState title="Nothing here" message="Try later" /></>)
  expect(screen.getByText('Recipes')).toBeInTheDocument()
  expect(screen.getByText('Nothing here')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run tests**

Run: `cd webapp && npm test -- src/components/ui/primitives.test.tsx`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
cd .. && git add -f webapp/src/lib/cn.ts webapp/src/components/ui/
git commit -m "feat(webapp): core UI primitives on token layer"
```

---

### Task 4: Data primitives — MetricValue, StatRow, MacroRing

The macro ring and stat readouts are the app's visual signature. The ring geometry is pure and unit-tested. Deliverable: `MacroRing` renders SVG arcs for consumed vs target.

**Files:**
- Create: `webapp/src/components/ui/MetricValue.tsx`, `webapp/src/components/ui/StatRow.tsx`, `webapp/src/components/ui/MacroRing.tsx`, `webapp/src/lib/ring.ts`, `webapp/src/lib/ring.test.ts`, `webapp/src/components/ui/macroRing.test.tsx`
- Modify: `webapp/src/components/ui/index.ts`

**Interfaces:**
- Produces:
  - `dashOffset(fraction: number, circumference: number): number` — remaining-arc offset, clamps fraction to [0,1]
  - `MetricValue(props: { value: string; label?: string; size?: 'lg' | 'md' | 'sm' })`
  - `StatRow(props: { items: Array<{ label: string; value: string }> })`
  - `MacroRing(props: { label: string; value: number; target?: number; unit: string; size?: number })`

- [ ] **Step 1: Write the failing ring-geometry test**

`webapp/src/lib/ring.test.ts`:
```ts
import { dashOffset } from './ring'

const C = 100

test('empty ring shows full offset (no arc drawn)', () => {
  expect(dashOffset(0, C)).toBe(100)
})
test('full ring shows zero offset (complete arc)', () => {
  expect(dashOffset(1, C)).toBe(0)
})
test('half ring shows half offset', () => {
  expect(dashOffset(0.5, C)).toBe(50)
})
test('over-target clamps to full arc', () => {
  expect(dashOffset(1.7, C)).toBe(0)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd webapp && npm test -- src/lib/ring.test.ts`
Expected: FAIL ("dashOffset is not a function" / module not found).

- [ ] **Step 3: Implement `ring.ts`**

`webapp/src/lib/ring.ts`:
```ts
/** Stroke-dashoffset for a ring where `fraction` (0..1+) of the circle is filled.
 *  offset = circumference * (1 - clampedFraction). */
export function dashOffset(fraction: number, circumference: number): number {
  const f = Math.max(0, Math.min(1, fraction))
  return circumference * (1 - f)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/ring.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Create the components**

`webapp/src/components/ui/MetricValue.tsx`:
```tsx
export function MetricValue({ value, label, size = 'md' }: { value: string; label?: string; size?: 'lg' | 'md' | 'sm' }) {
  const cls = size === 'lg' ? 'ds-metric-lg' : size === 'sm' ? 'ds-metric-sm' : 'ds-metric-md'
  return (
    <div className="flex flex-col items-center">
      <span className={`${cls} text-text-primary`}>{value}</span>
      {label && <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>}
    </div>
  )
}
```

`webapp/src/components/ui/StatRow.tsx`:
```tsx
export function StatRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="flex justify-around">
      {items.map(it => (
        <div key={it.label} className="flex flex-col items-center">
          <span className="ds-metric-sm text-text-primary">{it.value}</span>
          <span className="text-xs text-text-secondary uppercase tracking-wide">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
```

`webapp/src/components/ui/MacroRing.tsx`:
```tsx
import { dashOffset } from '../../lib/ring'

export function MacroRing({ label, value, target, unit, size = 96 }: {
  label: string; value: number; target?: number; unit: string; size?: number
}) {
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const fraction = target && target > 0 ? value / target : 0
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--outline-subtle)" strokeWidth={stroke} />
        {target && target > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dashOffset(fraction, c)}
          />
        )}
      </svg>
      <div className="-mt-[62%] flex flex-col items-center pointer-events-none">
        <span className="ds-metric-sm text-text-primary">{Math.round(value)}</span>
        {target ? <span className="text-[10px] text-text-secondary">/ {Math.round(target)}{unit}</span>
                : <span className="text-[10px] text-text-secondary">{unit}</span>}
      </div>
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>
    </div>
  )
}
```

- [ ] **Step 6: Add exports and a render test**

Append to `webapp/src/components/ui/index.ts`:
```ts
export { MetricValue } from './MetricValue'
export { StatRow } from './StatRow'
export { MacroRing } from './MacroRing'
```

`webapp/src/components/ui/macroRing.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MacroRing } from './MacroRing'

test('MacroRing shows value, target and label', () => {
  render(<MacroRing label="Calories" value={1200} target={2000} unit="" />)
  expect(screen.getByText('1200')).toBeInTheDocument()
  expect(screen.getByText('/ 2000')).toBeInTheDocument()
  expect(screen.getByText('Calories')).toBeInTheDocument()
})
```

- [ ] **Step 7: Run tests**

Run: `npm test -- src/components/ui/macroRing.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd .. && git add -f webapp/src/lib/ring.ts webapp/src/lib/ring.test.ts webapp/src/components/ui/MetricValue.tsx webapp/src/components/ui/StatRow.tsx webapp/src/components/ui/MacroRing.tsx webapp/src/components/ui/macroRing.test.tsx webapp/src/components/ui/index.ts
git commit -m "feat(webapp): metric/stat/macro-ring data primitives"
```

---

### Task 5: App shell — TopBar + BottomNav

Layout chrome: a top brand bar and a bottom nav, wrapping page content in a phone-width centered column on desktop. Deliverable: `AppShell` renders nav items and highlights the active route.

**Files:**
- Create: `webapp/src/components/AppShell.tsx`, `webapp/src/components/appShell.test.tsx`

**Interfaces:**
- Consumes: `react-router-dom` (`Outlet`, `NavLink`, `useLocation`), `lucide-react` icons.
- Produces: `AppShell()` (a routed layout component using `<Outlet />`).

- [ ] **Step 1: Create `AppShell`**

`webapp/src/components/AppShell.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { UtensilsCrossed, CalendarDays, BookOpen, History } from 'lucide-react'

const NAV = [
  { to: '/nutrition', label: 'Today', icon: UtensilsCrossed, end: true },
  { to: '/nutrition/plan', label: 'Plan', icon: CalendarDays, end: false },
  { to: '/nutrition/recipes', label: 'Recipes', icon: BookOpen, end: false },
  { to: '/nutrition/history', label: 'History', icon: History, end: false },
]

export function AppShell() {
  return (
    <div className="min-h-dvh bg-background flex justify-center">
      <div className="w-full max-w-[560px] flex flex-col min-h-dvh">
        <header className="sticky top-0 z-10 bg-background/90 backdrop-blur px-4 h-14 flex items-center border-b border-outline-subtle">
          <span className="text-xs font-bold tracking-widest text-text-primary uppercase">Coach Foska</span>
        </header>

        <main className="flex-1 px-4 pb-24 pt-4">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 w-full max-w-[560px] bg-surface border-t border-outline-subtle flex">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2 text-[11px] ${
                  isActive ? 'text-text-primary' : 'text-text-secondary'
                }`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write a render test**

`webapp/src/components/appShell.test.tsx`:
```tsx
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
  expect(screen.getByText('Today')).toBeInTheDocument()
  expect(screen.getByText('Recipes')).toBeInTheDocument()
  expect(screen.getByText('home')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test**

Run: `cd webapp && npm test -- src/components/appShell.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd .. && git add -f webapp/src/components/AppShell.tsx webapp/src/components/appShell.test.tsx
git commit -m "feat(webapp): app shell with top bar + bottom nav"
```

---

### Task 6: Supabase client, query client, and DB types

Wire the data layer by cloning admin's Supabase/logging/query setup and defining the nutrition row types. Deliverable: `supabase` client + `queryClient` importable; env validation covered by a test.

**Files:**
- Create: `webapp/src/lib/supabase.ts`, `webapp/src/lib/logger.ts`, `webapp/src/lib/loggingFetch.ts`, `webapp/src/lib/queryClient.ts`, `webapp/src/types/database.ts`, `webapp/src/lib/supabase.test.ts`

**Interfaces:**
- Produces: `supabase` (SupabaseClient), `queryClient` (QueryClient), `logger`; TS types `Profile, Goal, ActivityLevel, MealPlanRow, MealRow, MealFoodRow, RecipeRow, RecipeIngredientRow, RecipeStepRow, MealLogRow, MealLogFoodRow, FoodRow`.

- [ ] **Step 1: Copy the plumbing from admin (verbatim — identical env + config)**

```bash
cd webapp
cp ../admin/src/lib/supabase.ts src/lib/supabase.ts
cp ../admin/src/lib/logger.ts src/lib/logger.ts
cp ../admin/src/lib/loggingFetch.ts src/lib/loggingFetch.ts
cp ../admin/src/lib/queryClient.ts src/lib/queryClient.ts
```
If `queryClient.ts` does not exist in admin, create `webapp/src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})
```

- [ ] **Step 2: Define the nutrition DB row types**

`webapp/src/types/database.ts`:
```ts
export type Goal = 'build_muscle' | 'lose_weight' | 'stay_fit' | 'get_stronger'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'

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
}

export interface MealFoodRow {
  id: string
  meal_id: string
  name: string
  amount_grams: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}
export interface MealRow {
  id: string
  meal_plan_id: string
  name: string
  time_of_day: string | null
  sort_order: number
  day_of_week: number | null
  meal_foods: MealFoodRow[]
}
export interface MealPlanRow {
  id: string
  name: string
  description: string | null
  valid_from: string | null
  valid_to: string | null
  meals: MealRow[]
}

export interface RecipeIngredientRow {
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
export interface RecipeStepRow {
  id: string
  recipe_id: string
  step_number: number
  instruction: string
}
export interface RecipeRow {
  id: string
  name: string
  description: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  photo_url: string | null
  prep_time_min: number | null
  cook_time_min: number | null
  servings: number
  difficulty: string | null
  tags: string[]
  featured: boolean
  recipe_ingredients?: RecipeIngredientRow[]
  recipe_steps?: RecipeStepRow[]
}

export interface MealLogFoodRow {
  id: string
  meal_log_id: string
  name: string
  amount: number
  unit: string
  amount_grams: number | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}
export interface MealLogRow {
  id: string
  user_id: string
  meal_name: string
  notes: string | null
  image_url: string | null
  logged_at: string
  meal_log_foods: MealLogFoodRow[]
}

export interface FoodRow {
  id: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size: number
  serving_unit: string
  brand: string | null
  is_verified: boolean
}
```

- [ ] **Step 3: Write an env-validation test**

`webapp/src/lib/supabase.test.ts`:
```ts
test('supabase client is created with configured env', async () => {
  const { supabase } = await import('./supabase')
  expect(supabase).toBeDefined()
  expect(typeof supabase.from).toBe('function')
})
```
(Vitest reads `.env` via Vite; the `.env` copied in Task 1 satisfies the client's env guard. If the guard throws, ensure `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set in `webapp/.env`.)

- [ ] **Step 4: Run the test**

Run: `cd webapp && npm test -- src/lib/supabase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd .. && git add -f webapp/src/lib/supabase.ts webapp/src/lib/logger.ts webapp/src/lib/loggingFetch.ts webapp/src/lib/queryClient.ts webapp/src/types/database.ts webapp/src/lib/supabase.test.ts
git commit -m "feat(webapp): supabase client, query client, nutrition DB types"
```

---

### Task 7: Auth (email OTP) + routing skeleton

De-adminned auth + login/verify pages + route guard + the router wiring `AppShell`. Deliverable: unauthenticated users are redirected to `/login`; verifying a code lands on `/nutrition`.

**Files:**
- Create: `webapp/src/hooks/useAuth.tsx`, `webapp/src/components/RouteGuard.tsx`, `webapp/src/pages/Login.tsx`, `webapp/src/pages/Verify.tsx`, `webapp/src/pages/nutrition/Placeholder.tsx`, `webapp/src/hooks/useAuth.test.tsx`, `webapp/src/components/routeGuard.test.tsx`
- Modify: `webapp/src/App.tsx`

**Interfaces:**
- Consumes: `supabase`, `queryClient`, `Profile` type, `AppShell`.
- Produces: `AuthProvider`, `useAuth(): { session, user, profile, isLoading }`; `RouteGuard()` (Outlet guard → `/login`); default-exported `Login`, `Verify`.

- [ ] **Step 1: Create the de-adminned `useAuth`**

`webapp/src/hooks/useAuth.tsx`:
```tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { Profile } from '../types/database'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
}

const initialState: AuthState = { session: null, user: null, profile: null, isLoading: true }
const AuthContext = createContext<AuthState>(initialState)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)

  async function resolveSession(session: Session | null) {
    if (!session) { setState({ ...initialState, isLoading: false }); return }
    try {
      const profile = await fetchProfile(session.user.id)
      setState({ session, user: session.user, profile, isLoading: false })
    } catch (err) {
      logger.error('resolveSession failed', err)
      // Keep the session even if the profile row is missing (new user).
      setState({ session, user: session.user, profile: null, isLoading: false })
    }
  }

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => resolveSession(session))
      .catch(err => { logger.error('getSession failed', err); setState(s => ({ ...s, isLoading: false })) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => resolveSession(session))
    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 2: Create the route guard**

`webapp/src/components/RouteGuard.tsx`:
```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function RouteGuard() {
  const { session, isLoading } = useAuth()
  if (isLoading) {
    return <div className="min-h-dvh bg-background flex items-center justify-center">
      <p className="text-text-secondary text-sm">Loading…</p>
    </div>
  }
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
```

- [ ] **Step 3: Create Login (restyled, `shouldCreateUser: true`)**

`webapp/src/pages/Login.tsx`:
```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Input, Button } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { session, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && session) navigate('/nutrition', { replace: true })
  }, [authLoading, session, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const clean = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } })
    setLoading(false)
    if (error) { setError(error.message); return }
    sessionStorage.setItem('otp-email', clean)
    navigate('/verify')
  }

  if (authLoading) {
    return <div className="min-h-dvh bg-background flex items-center justify-center">
      <p className="text-text-secondary text-sm">Loading…</p>
    </div>
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-xs font-bold tracking-widest text-text-primary uppercase mb-8">Coach Foska</div>
        <h1 className="ds-display-lg text-text-primary mb-2">Ahoj 👋</h1>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Zadaj svoj email a pošleme ti jednorazový kód na prihlásenie.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input id="email" type="email" label="Email" placeholder="ty@email.sk"
                 value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          {error && <p className="text-xs text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={!email}>Poslať kód →</Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create Verify (restyled, lands on `/nutrition`)**

`webapp/src/pages/Verify.tsx`:
```tsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { Button } from '../components/ui'

export default function Verify() {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const navigate = useNavigate()
  const [email] = useState(() => sessionStorage.getItem('otp-email') ?? '')

  useEffect(() => { if (!email) navigate('/login') }, [email, navigate])
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  function handleDigitChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    if (value.length > 1) {
      const pasted = value.slice(0, 6 - index)
      const next = [...digits]
      for (let i = 0; i < pasted.length; i++) next[index + i] = pasted[i]
      setDigits(next)
      inputs.current[Math.min(index + pasted.length, 5)]?.focus()
      return
    }
    const next = [...digits]; next[index] = value; setDigits(next)
    if (value && index < 5) inputs.current[index + 1]?.focus()
  }
  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus()
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const token = digits.join('')
    if (token.length < 6) return
    setError(''); setLoading(true)
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (verifyError) { setError(verifyError.message); return }
      if (!data.user) { setError('Overenie zlyhalo.'); return }
      sessionStorage.removeItem('otp-email')
      navigate('/nutrition', { replace: true })
    } catch (err) {
      logger.error('verify error', err)
      setError(err instanceof Error ? err.message : 'Neočakávaná chyba.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    setResendCooldown(60)
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-xs font-bold tracking-widest text-text-primary uppercase mb-8">Coach Foska</div>
        <h1 className="text-xl font-bold text-text-primary mb-2">Skontroluj email</h1>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Poslali sme 6-miestny kód na <span className="text-text-primary">{email}</span>.
        </p>
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex gap-2 justify-center">
            {digits.map((d, i) => (
              <input key={i} ref={el => { inputs.current[i] = el }} type="text" inputMode="numeric" maxLength={1}
                value={d} onChange={e => handleDigitChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
                autoFocus={i === 0}
                className="w-11 h-12 text-center text-lg font-bold bg-surface-elevated border border-outline rounded-md text-text-primary outline-none focus:border-text-secondary" />
            ))}
          </div>
          {error && <p className="text-xs text-error text-center">{error}</p>}
          <Button type="submit" loading={loading} disabled={digits.join('').length < 6}>Overiť kód</Button>
        </form>
        <p className="text-xs text-text-secondary text-center mt-4">
          {resendCooldown > 0 ? `Poslať znova o ${resendCooldown}s`
            : <button onClick={handleResend} className="text-text-primary underline bg-transparent border-0 cursor-pointer">Poslať znova</button>}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create a temporary nutrition placeholder page**

`webapp/src/pages/nutrition/Placeholder.tsx`:
```tsx
export default function Placeholder({ name }: { name: string }) {
  return <div className="text-text-secondary text-sm">{name} — coming soon</div>
}
```

- [ ] **Step 6: Wire the router in `App.tsx`**

`webapp/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './hooks/useAuth'
import { RouteGuard } from './components/RouteGuard'
import { AppShell } from './components/AppShell'
import Login from './pages/Login'
import Verify from './pages/Verify'
import Placeholder from './pages/nutrition/Placeholder'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/verify" element={<Verify />} />
            <Route element={<RouteGuard />}>
              <Route element={<AppShell />}>
                <Route path="/nutrition" element={<Placeholder name="Today" />} />
                <Route path="/nutrition/plan" element={<Placeholder name="Plan" />} />
                <Route path="/nutrition/recipes" element={<Placeholder name="Recipes" />} />
                <Route path="/nutrition/history" element={<Placeholder name="History" />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/nutrition" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 7: Update the smoke test (App now needs a router-free assertion)**

Replace `webapp/src/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('unauthenticated app shows the login screen', async () => {
  render(<App />)
  expect(await screen.findByText('Poslať kód →')).toBeInTheDocument()
})
```

- [ ] **Step 8: Write auth + guard unit tests (mock supabase)**

`webapp/src/hooks/useAuth.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn(),
  },
}))

function Probe() {
  const { isLoading, session } = useAuth()
  return <div>{isLoading ? 'loading' : session ? 'in' : 'out'}</div>
}

test('resolves to signed-out when no session', async () => {
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())
})
```

`webapp/src/components/routeGuard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RouteGuard } from './RouteGuard'
import * as auth from '../hooks/useAuth'

test('redirects to /login when unauthenticated', () => {
  vi.spyOn(auth, 'useAuth').mockReturnValue({ session: null, user: null, profile: null, isLoading: false })
  render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <Routes>
        <Route element={<RouteGuard />}>
          <Route path="/nutrition" element={<div>secret</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('login page')).toBeInTheDocument()
})
```

- [ ] **Step 9: Run the tests**

Run: `cd webapp && npm test`
Expected: all passing (smoke + auth + guard + earlier tasks).

- [ ] **Step 10: Commit**

```bash
cd .. && git add -f webapp/src/hooks/useAuth.tsx webapp/src/hooks/useAuth.test.tsx webapp/src/components/RouteGuard.tsx webapp/src/components/routeGuard.test.tsx webapp/src/pages/Login.tsx webapp/src/pages/Verify.tsx webapp/src/pages/nutrition/Placeholder.tsx webapp/src/App.tsx webapp/src/smoke.test.tsx
git commit -m "feat(webapp): email-OTP auth, route guard, router skeleton"
```

---

### Task 8: Pure nutrition calculations

The math the whole feature relies on — portion scaling, daily macro summing, macro-target formula. Pure functions, TDD-first. Deliverable: fully-tested `nutrition/calc.ts`.

**Files:**
- Create: `webapp/src/nutrition/calc.ts`, `webapp/src/nutrition/calc.test.ts`

**Interfaces:**
- Consumes: `FoodRow`, `MealLogFoodRow`, `Profile`, `Goal`, `ActivityLevel` from `types/database`.
- Produces:
  - `type Macros = { calories: number; protein_g: number; carbs_g: number; fat_g: number }`
  - `scaleFood(food: FoodRow, amount: number): Macros & { name: string; amount: number; unit: string }` — scales per-serving macros to `amount` of `serving_unit`
  - `sumMacros(foods: Array<Partial<Macros>>): Macros`
  - `calcMacroTargets(p: Pick<Profile,'weight_kg'|'height_cm'|'age'|'goal'|'activity_level'>): Macros | null`

- [ ] **Step 1: Write the failing tests**

`webapp/src/nutrition/calc.test.ts`:
```ts
import { scaleFood, sumMacros, calcMacroTargets } from './calc'
import type { FoodRow } from '../types/database'

const chicken: FoodRow = {
  id: '1', name: 'Chicken breast', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6,
  serving_size: 100, serving_unit: 'g', brand: null, is_verified: true,
}

test('scaleFood scales macros linearly by amount / serving_size', () => {
  const r = scaleFood(chicken, 200)
  expect(r.calories).toBeCloseTo(330)
  expect(r.protein_g).toBeCloseTo(62)
  expect(r.amount).toBe(200)
  expect(r.unit).toBe('g')
  expect(r.name).toBe('Chicken breast')
})

test('scaleFood with zero serving_size does not divide by zero', () => {
  const r = scaleFood({ ...chicken, serving_size: 0 }, 200)
  expect(r.calories).toBe(0)
})

test('sumMacros totals a list', () => {
  const total = sumMacros([
    { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 2 },
    { calories: 250, protein_g: 5, carbs_g: 30, fat_g: 8 },
  ])
  expect(total).toEqual({ calories: 350, protein_g: 15, carbs_g: 35, fat_g: 10 })
})

test('calcMacroTargets: Mifflin–St Jeor, 1.8g/kg protein, 25% fat, carbs remainder', () => {
  // 80kg, 180cm, 30y, moderately_active, build_muscle
  // bmr = 10*80 + 6.25*180 - 5*30 + 5 = 1780
  // tdee = 1780 * 1.55 = 2759 ; kcal = 2759 * 1.10 = 3034.9
  const t = calcMacroTargets({ weight_kg: 80, height_cm: 180, age: 30, activity_level: 'moderately_active', goal: 'build_muscle' })!
  expect(t.calories).toBeCloseTo(3034.9, 0)
  expect(t.protein_g).toBeCloseTo(144)      // 80 * 1.8
  expect(t.fat_g).toBeCloseTo(3034.9 * 0.25 / 9, 1)
  expect(t.carbs_g).toBeGreaterThan(0)
})

test('calcMacroTargets returns null when any input missing', () => {
  expect(calcMacroTargets({ weight_kg: null, height_cm: 180, age: 30, activity_level: 'active', goal: 'stay_fit' })).toBeNull()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd webapp && npm test -- src/nutrition/calc.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `calc.ts`**

`webapp/src/nutrition/calc.ts`:
```ts
import type { FoodRow, Profile, ActivityLevel, Goal } from '../types/database'

export type Macros = { calories: number; protein_g: number; carbs_g: number; fat_g: number }

export function scaleFood(food: FoodRow, amount: number): Macros & { name: string; amount: number; unit: string } {
  const factor = food.serving_size > 0 ? amount / food.serving_size : 0
  return {
    name: food.name,
    amount,
    unit: food.serving_unit,
    calories: food.calories * factor,
    protein_g: food.protein_g * factor,
    carbs_g: food.carbs_g * factor,
    fat_g: food.fat_g * factor,
  }
}

export function sumMacros(foods: Array<Partial<Macros>>): Macros {
  return foods.reduce<Macros>(
    (acc, f) => ({
      calories: acc.calories + (f.calories ?? 0),
      protein_g: acc.protein_g + (f.protein_g ?? 0),
      carbs_g: acc.carbs_g + (f.carbs_g ?? 0),
      fat_g: acc.fat_g + (f.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
}

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, active: 1.725, very_active: 1.9,
}
const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose_weight: 0.85, build_muscle: 1.10, get_stronger: 1.05, stay_fit: 1.0,
}

export function calcMacroTargets(
  p: Pick<Profile, 'weight_kg' | 'height_cm' | 'age' | 'goal' | 'activity_level'>,
): Macros | null {
  const { weight_kg, height_cm, age, activity_level, goal } = p
  if (weight_kg == null || height_cm == null || age == null || activity_level == null) return null
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
  const tdee = bmr * ACTIVITY_MULTIPLIER[activity_level]
  const calories = tdee * (goal ? GOAL_ADJUSTMENT[goal] : 1.0)
  const protein_g = weight_kg * 1.8
  const fat_g = (calories * 0.25) / 9
  const carbs_g = Math.max(0, (calories - protein_g * 4 - fat_g * 9) / 4)
  return { calories, protein_g, carbs_g, fat_g }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/nutrition/calc.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
cd .. && git add -f webapp/src/nutrition/calc.ts webapp/src/nutrition/calc.test.ts
git commit -m "feat(webapp): pure nutrition math (portion, summing, macro targets)"
```

---

### Task 9: Read query hooks + test harness

TanStack Query hooks wrapping supabase-js reads, mirroring `MealRemoteDataSource`. Deliverable: hooks return typed data; a shared test harness + representative tests pass against a mocked supabase.

**Files:**
- Create: `webapp/src/nutrition/queries.ts`, `webapp/src/nutrition/hooks.ts`, `webapp/src/test/renderHook.tsx`, `webapp/src/test/supabaseMock.ts`, `webapp/src/nutrition/hooks.test.tsx`

**Interfaces:**
- Consumes: `supabase`, DB row types, `useAuth`, `calcMacroTargets`, `sumMacros`.
- Produces (all React Query hooks):
  - `useActiveMealPlan(): UseQueryResult<MealPlanRow | null>`
  - `useRecipes(): UseQueryResult<RecipeRow[]>`
  - `useRecipe(id: string): UseQueryResult<RecipeRow | null>`
  - `useMealHistory(): UseQueryResult<MealLogRow[]>`
  - `useDailyLogs(date: string /* YYYY-MM-DD */): UseQueryResult<MealLogRow[]>`
  - `useDailySummary(date: string): { data: Macros; isLoading: boolean }`
  - `useMacroTargets(): Macros | null`
  - `useFoodSearch(query: string): UseQueryResult<FoodRow[]>`
  - `useFavorites(): UseQueryResult<Set<string>>`
- Also produces query-key constants in `queries.ts`: `qk.mealPlan`, `qk.recipes`, `qk.recipe(id)`, `qk.history`, `qk.dailyLogs(date)`, `qk.foodSearch(q)`, `qk.favorites`.

- [ ] **Step 1: Create query keys + raw fetchers**

`webapp/src/nutrition/queries.ts`:
```ts
import { supabase } from '../lib/supabase'
import type { MealPlanRow, RecipeRow, MealLogRow, FoodRow } from '../types/database'

export const qk = {
  mealPlan: ['mealPlan'] as const,
  recipes: ['recipes'] as const,
  recipe: (id: string) => ['recipe', id] as const,
  history: ['mealHistory'] as const,
  dailyLogs: (date: string) => ['dailyLogs', date] as const,
  foodSearch: (q: string) => ['foodSearch', q] as const,
  favorites: ['favorites'] as const,
}

export async function fetchActiveMealPlan(): Promise<MealPlanRow | null> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*, meals(*, meal_foods(*))')
    .eq('is_active', true)
    .limit(1)
  if (error) throw error
  return (data?.[0] as MealPlanRow) ?? null
}

export async function fetchRecipes(): Promise<RecipeRow[]> {
  const { data, error } = await supabase.from('recipes').select('*')
  if (error) throw error
  return (data as RecipeRow[]) ?? []
}

export async function fetchRecipe(id: string): Promise<RecipeRow | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*), recipe_steps(*)')
    .eq('id', id)
    .limit(1)
  if (error) throw error
  return (data?.[0] as RecipeRow) ?? null
}

export async function fetchMealHistory(userId: string): Promise<MealLogRow[]> {
  const { data, error } = await supabase
    .from('meal_logs')
    .select('*, meal_log_foods(*)')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
  if (error) throw error
  return (data as MealLogRow[]) ?? []
}

export async function fetchDailyLogs(userId: string, date: string): Promise<MealLogRow[]> {
  const start = `${date}T00:00:00Z`
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  const end = `${d.toISOString().slice(0, 10)}T00:00:00Z`
  const { data, error } = await supabase
    .from('meal_logs')
    .select('*, meal_log_foods(*)')
    .eq('user_id', userId)
    .gte('logged_at', start)
    .lt('logged_at', end)
  if (error) throw error
  return (data as MealLogRow[]) ?? []
}

export async function searchFoods(query: string): Promise<FoodRow[]> {
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(20)
  if (error) throw error
  return (data as FoodRow[]) ?? []
}

export async function fetchFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('recipe_favorites').select('recipe_id').eq('user_id', userId)
  if (error) throw error
  return (data as Array<{ recipe_id: string }>).map(r => r.recipe_id)
}
```

- [ ] **Step 2: Create the hooks**

`webapp/src/nutrition/hooks.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { calcMacroTargets, sumMacros, type Macros } from './calc'
import {
  qk, fetchActiveMealPlan, fetchRecipes, fetchRecipe, fetchMealHistory,
  fetchDailyLogs, searchFoods, fetchFavoriteIds,
} from './queries'

export function useActiveMealPlan() {
  return useQuery({ queryKey: qk.mealPlan, queryFn: fetchActiveMealPlan })
}
export function useRecipes() {
  return useQuery({ queryKey: qk.recipes, queryFn: fetchRecipes })
}
export function useRecipe(id: string) {
  return useQuery({ queryKey: qk.recipe(id), queryFn: () => fetchRecipe(id), enabled: !!id })
}
export function useMealHistory() {
  const { user } = useAuth()
  return useQuery({ queryKey: qk.history, queryFn: () => fetchMealHistory(user!.id), enabled: !!user })
}
export function useDailyLogs(date: string) {
  const { user } = useAuth()
  return useQuery({ queryKey: qk.dailyLogs(date), queryFn: () => fetchDailyLogs(user!.id, date), enabled: !!user })
}
export function useDailySummary(date: string): { data: Macros; isLoading: boolean } {
  const { data, isLoading } = useDailyLogs(date)
  const foods = (data ?? []).flatMap(log => log.meal_log_foods)
  return { data: sumMacros(foods), isLoading }
}
export function useMacroTargets(): Macros | null {
  const { profile } = useAuth()
  if (!profile) return null
  return calcMacroTargets(profile)
}
export function useFoodSearch(query: string) {
  return useQuery({
    queryKey: qk.foodSearch(query),
    queryFn: () => searchFoods(query),
    enabled: query.trim().length >= 2,
  })
}
export function useFavorites() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.favorites,
    queryFn: async () => new Set(await fetchFavoriteIds(user!.id)),
    enabled: !!user,
  })
}
```

- [ ] **Step 3: Create the test harness**

`webapp/src/test/renderHook.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

export function renderHookWithClient<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(hook, { wrapper })
}
```

`webapp/src/test/supabaseMock.ts`:
```ts
/** Builds a chainable supabase-query mock whose terminal await resolves to `result`.
 *  Every builder method returns the same thenable, so any chain
 *  (.select().eq().order()...) resolves to { data, error }. */
export function makeQueryResult(result: { data: unknown; error: unknown }) {
  const thenable: any = {
    select: () => thenable,
    eq: () => thenable,
    ilike: () => thenable,
    gte: () => thenable,
    lt: () => thenable,
    order: () => thenable,
    limit: () => thenable,
    single: () => Promise.resolve(result),
    then: (resolve: (v: unknown) => void) => resolve(result),
  }
  return thenable
}
```

- [ ] **Step 4: Write representative hook tests**

`webapp/src/nutrition/hooks.test.tsx`:
```tsx
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../test/renderHook'
import { makeQueryResult } from '../test/supabaseMock'
import { useRecipes, useDailySummary } from './hooks'

const fromMock = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: null }) }))

test('useRecipes returns rows from supabase', async () => {
  fromMock.mockReturnValue(makeQueryResult({ data: [{ id: 'r1', name: 'Oats' }], error: null }))
  const { result } = renderHookWithClient(() => useRecipes())
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([{ id: 'r1', name: 'Oats' }])
})

test('useDailySummary sums the day\'s logged foods', async () => {
  fromMock.mockReturnValue(makeQueryResult({
    data: [{ id: 'l1', meal_log_foods: [
      { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 2 },
      { calories: 200, protein_g: 5, carbs_g: 20, fat_g: 8 },
    ] }],
    error: null,
  }))
  const { result } = renderHookWithClient(() => useDailySummary('2026-07-10'))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.data.calories).toBe(300)
  expect(result.current.data.protein_g).toBe(15)
})
```

- [ ] **Step 5: Run the tests**

Run: `cd webapp && npm test -- src/nutrition/hooks.test.tsx`
Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
cd .. && git add -f webapp/src/nutrition/queries.ts webapp/src/nutrition/hooks.ts webapp/src/test/renderHook.tsx webapp/src/test/supabaseMock.ts webapp/src/nutrition/hooks.test.tsx
git commit -m "feat(webapp): nutrition read hooks + query test harness"
```

---

### Task 10: Write hooks — log meal + toggle favorite

The two interactive write paths. `useLogMeal` inserts a `meal_log` then its `meal_log_foods` (populating both `amount`/`unit` and `amount_grams`), then invalidates the day + history. Deliverable: mutations tested against a mocked supabase.

**Files:**
- Create: `webapp/src/nutrition/mutations.ts`, `webapp/src/nutrition/mutations.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `queryClient` keys `qk`, `useAuth`, `Macros`.
- Produces:
  - `type LogFoodInput = { name: string; amount: number; unit: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }`
  - `useLogMeal(): UseMutationResult<void, Error, { mealName: string; foods: LogFoodInput[]; notes?: string }>`
  - `useToggleFavorite(): UseMutationResult<void, Error, { recipeId: string; isFavorite: boolean }>`

- [ ] **Step 1: Create the mutations**

`webapp/src/nutrition/mutations.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { qk } from './queries'

export type LogFoodInput = {
  name: string; amount: number; unit: string
  calories: number; protein_g: number; carbs_g: number; fat_g: number
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useLogMeal() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ mealName, foods, notes }: { mealName: string; foods: LogFoodInput[]; notes?: string }) => {
      const { data: log, error: logErr } = await supabase
        .from('meal_logs')
        .insert({ user_id: user!.id, meal_name: mealName, logged_at: new Date().toISOString(), notes: notes ?? null, image_url: null })
        .select()
        .single()
      if (logErr) throw logErr
      const rows = foods.map(f => ({
        meal_log_id: (log as { id: string }).id,
        name: f.name,
        amount: f.amount,
        unit: f.unit,
        amount_grams: f.amount, // keep populated: legacy NOT NULL column
        calories: f.calories,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
      }))
      const { error: foodErr } = await supabase.from('meal_log_foods').insert(rows)
      if (foodErr) throw foodErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.dailyLogs(todayIso()) })
      qc.invalidateQueries({ queryKey: qk.history })
    },
  })
}

export function useToggleFavorite() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ recipeId, isFavorite }: { recipeId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        const { error } = await supabase.from('recipe_favorites').delete()
          .eq('user_id', user!.id).eq('recipe_id', recipeId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('recipe_favorites')
          .upsert({ user_id: user!.id, recipe_id: recipeId })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.favorites }),
  })
}
```

- [ ] **Step 2: Write a mutation test**

`webapp/src/nutrition/mutations.test.tsx`:
```tsx
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../test/renderHook'
import { useLogMeal } from './mutations'

const insertSpy = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        insertSpy(table, payload)
        return {
          select: () => ({ single: () => Promise.resolve({ data: { id: 'log1' }, error: null }) }),
          // meal_log_foods insert (no .select()) is awaited directly:
          then: (resolve: (v: unknown) => void) => resolve({ error: null }),
        }
      },
    }),
  },
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

test('useLogMeal inserts a log then its foods with amount_grams populated', async () => {
  const { result } = renderHookWithClient(() => useLogMeal())
  result.current.mutate({
    mealName: 'Lunch',
    foods: [{ name: 'Rice', amount: 150, unit: 'g', calories: 200, protein_g: 4, carbs_g: 44, fat_g: 1 }],
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  const foodsCall = insertSpy.mock.calls.find(c => c[0] === 'meal_log_foods')
  expect(foodsCall).toBeTruthy()
  expect(foodsCall![1][0]).toMatchObject({ meal_log_id: 'log1', amount: 150, unit: 'g', amount_grams: 150 })
})
```

- [ ] **Step 3: Run the test**

Run: `cd webapp && npm test -- src/nutrition/mutations.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd .. && git add -f webapp/src/nutrition/mutations.ts webapp/src/nutrition/mutations.test.tsx
git commit -m "feat(webapp): log-meal + toggle-favorite mutations"
```

---

### Task 11: Nutrition Hub / Today screen

The landing screen: daily macro rings vs targets, a "Log meal" CTA, featured recipes, and entry cards to Plan / Recipes / History. Deliverable: `/nutrition` renders live data with loading + empty states.

**Files:**
- Create: `webapp/src/nutrition/date.ts`, `webapp/src/pages/nutrition/Hub.tsx`, `webapp/src/pages/nutrition/hub.test.tsx`
- Modify: `webapp/src/App.tsx` (swap the `/nutrition` placeholder for `Hub`)

**Interfaces:**
- Consumes: `useDailySummary`, `useMacroTargets`, `useRecipes`, `MacroRing`, `Card`, `SectionHeader`, `Button`, `Shimmer`.
- Produces: `todayIso(): string` in `date.ts`; default-exported `Hub`.

- [ ] **Step 1: Create the date helper (shared)**

`webapp/src/nutrition/date.ts`:
```ts
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
```
Then update `webapp/src/nutrition/mutations.ts` to import it instead of its local copy: replace the local `function todayIso()` with `import { todayIso } from './date'` at the top and delete the local definition.

- [ ] **Step 2: Create the Hub screen**

`webapp/src/pages/nutrition/Hub.tsx`:
```tsx
import { useNavigate } from 'react-router-dom'
import { useDailySummary, useMacroTargets, useRecipes } from '../../nutrition/hooks'
import { todayIso } from '../../nutrition/date'
import { Card, SectionHeader, Button, Shimmer, MacroRing } from '../../components/ui'

export default function Hub() {
  const navigate = useNavigate()
  const { data: summary, isLoading } = useDailySummary(todayIso())
  const targets = useMacroTargets()
  const { data: recipes } = useRecipes()
  const featured = (recipes ?? []).filter(r => r.featured).slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionHeader title="Dnes" />
        <Card>
          {isLoading ? (
            <div className="flex justify-around">
              <Shimmer className="w-24 h-24 rounded-full" />
              <Shimmer className="w-24 h-24 rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 place-items-center">
              <MacroRing label="Kcal" value={summary.calories} target={targets?.calories} unit="" />
              <MacroRing label="Bielk." value={summary.protein_g} target={targets?.protein_g} unit="g" />
              <MacroRing label="Sach." value={summary.carbs_g} target={targets?.carbs_g} unit="g" />
              <MacroRing label="Tuky" value={summary.fat_g} target={targets?.fat_g} unit="g" />
            </div>
          )}
          <Button className="w-full mt-4" onClick={() => navigate('/nutrition/log')}>+ Zapísať jedlo</Button>
        </Card>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer text-center py-3" onClick={() => navigate('/nutrition/plan')}>
          <p className="text-sm font-semibold text-text-primary">Plán</p>
        </Card>
        <Card className="cursor-pointer text-center py-3" onClick={() => navigate('/nutrition/recipes')}>
          <p className="text-sm font-semibold text-text-primary">Recepty</p>
        </Card>
        <Card className="cursor-pointer text-center py-3" onClick={() => navigate('/nutrition/history')}>
          <p className="text-sm font-semibold text-text-primary">História</p>
        </Card>
      </section>

      {featured.length > 0 && (
        <section>
          <SectionHeader title="Odporúčané recepty" />
          <div className="flex gap-3 overflow-x-auto pb-2">
            {featured.map(r => (
              <Card key={r.id} className="min-w-40 cursor-pointer" onClick={() => navigate(`/nutrition/recipes/${r.id}`)}>
                {r.photo_url && <img src={r.photo_url} alt={r.name} className="w-full h-24 object-cover rounded-lg mb-2" />}
                <p className="text-sm font-semibold text-text-primary line-clamp-2">{r.name}</p>
                <p className="text-xs text-text-secondary">{Math.round(r.calories)} kcal</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire the route** — in `webapp/src/App.tsx`, replace
`<Route path="/nutrition" element={<Placeholder name="Today" />} />` with:
```tsx
<Route path="/nutrition" element={<Hub />} />
```
and add `import Hub from './pages/nutrition/Hub'` at the top.

- [ ] **Step 4: Write a render test (mock the hooks)**

`webapp/src/pages/nutrition/hub.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Hub from './Hub'

vi.mock('../../nutrition/hooks', () => ({
  useDailySummary: () => ({ data: { calories: 800, protein_g: 40, carbs_g: 90, fat_g: 20 }, isLoading: false }),
  useMacroTargets: () => ({ calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 }),
  useRecipes: () => ({ data: [] }),
}))

test('Hub shows the day summary and a log CTA', () => {
  render(<MemoryRouter><Hub /></MemoryRouter>)
  expect(screen.getByText('800')).toBeInTheDocument()
  expect(screen.getByText('+ Zapísať jedlo')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run tests + build**

Run: `cd webapp && npm test -- src/pages/nutrition/hub.test.tsx && npm run build`
Expected: test passes; build succeeds.

- [ ] **Step 6: Commit**

```bash
cd .. && git add -f webapp/src/nutrition/date.ts webapp/src/nutrition/mutations.ts webapp/src/pages/nutrition/Hub.tsx webapp/src/pages/nutrition/hub.test.tsx webapp/src/App.tsx
git commit -m "feat(webapp): nutrition Hub/Today screen"
```

---

### Task 12: Meal Plan screen

The assigned weekly plan: a day-of-week selector and meal cards with foods + per-meal macro totals. Deliverable: `/nutrition/plan` renders the active plan filtered by selected day.

**Files:**
- Create: `webapp/src/nutrition/mealPlan.ts`, `webapp/src/nutrition/mealPlan.test.ts`, `webapp/src/pages/nutrition/Plan.tsx`, `webapp/src/pages/nutrition/plan.test.tsx`
- Modify: `webapp/src/App.tsx`

**Interfaces:**
- Consumes: `useActiveMealPlan`, `sumMacros`, `Card`, `Chip`, `EmptyState`, `Shimmer`, `MealRow`, `MealFoodRow`.
- Produces:
  - `mealsForDay(meals: MealRow[], day: number): MealRow[]` — keeps meals where `day_of_week === day || day_of_week == null`, sorted by `sort_order`
  - `todayDowMon0(): number` — 0=Mon…6=Sun for today
  - default-exported `Plan`.

- [ ] **Step 1: Write the failing day-filter tests**

`webapp/src/nutrition/mealPlan.test.ts`:
```ts
import { mealsForDay, todayDowMon0 } from './mealPlan'
import type { MealRow } from '../types/database'

const m = (id: string, day: number | null, sort = 0): MealRow => ({
  id, meal_plan_id: 'p', name: id, time_of_day: null, sort_order: sort, day_of_week: day, meal_foods: [],
})

test('keeps meals for the given day plus every-day (null) meals, sorted', () => {
  const meals = [m('a', 2, 1), m('b', null, 0), m('c', 3, 0)]
  expect(mealsForDay(meals, 2).map(x => x.id)).toEqual(['b', 'a'])
})

test('todayDowMon0 returns 0..6', () => {
  const d = todayDowMon0()
  expect(d).toBeGreaterThanOrEqual(0)
  expect(d).toBeLessThanOrEqual(6)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd webapp && npm test -- src/nutrition/mealPlan.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `mealPlan.ts`**

`webapp/src/nutrition/mealPlan.ts`:
```ts
import type { MealRow } from '../types/database'

export function mealsForDay(meals: MealRow[], day: number): MealRow[] {
  return meals
    .filter(mm => mm.day_of_week === day || mm.day_of_week == null)
    .sort((a, b) => a.sort_order - b.sort_order)
}

/** JS getDay(): 0=Sun..6=Sat → app convention 0=Mon..6=Sun. */
export function todayDowMon0(): number {
  const js = new Date().getDay()
  return (js + 6) % 7
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/nutrition/mealPlan.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the Plan screen**

`webapp/src/pages/nutrition/Plan.tsx`:
```tsx
import { useState } from 'react'
import { useActiveMealPlan } from '../../nutrition/hooks'
import { mealsForDay, todayDowMon0 } from '../../nutrition/mealPlan'
import { sumMacros } from '../../nutrition/calc'
import { Card, Chip, SectionHeader, EmptyState, Shimmer } from '../../components/ui'

const DAYS = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

export default function Plan() {
  const { data: plan, isLoading } = useActiveMealPlan()
  const [day, setDay] = useState(todayDowMon0())

  if (isLoading) return <Shimmer className="h-40 w-full" />
  if (!plan) return <EmptyState title="Žiadny plán" message="Tréner ti zatiaľ nepriradil jedálniček." />

  const meals = mealsForDay(plan.meals ?? [], day)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title={plan.name} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map((d, i) => <Chip key={d} selected={i === day} onClick={() => setDay(i)}>{d}</Chip>)}
      </div>

      {meals.length === 0 && <EmptyState title="Voľný deň" message="Na tento deň nie sú naplánované žiadne jedlá." />}

      {meals.map(meal => {
        const totals = sumMacros(meal.meal_foods)
        return (
          <Card key={meal.id}>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-bold text-text-primary">{meal.name}</h3>
              {meal.time_of_day && <span className="text-xs text-text-secondary">{meal.time_of_day}</span>}
            </div>
            <ul className="flex flex-col gap-1 mb-3">
              {meal.meal_foods.map(f => (
                <li key={f.id} className="flex justify-between text-sm">
                  <span className="text-text-primary">{f.name}</span>
                  <span className="text-text-secondary">{Math.round(f.amount_grams)} g · {Math.round(f.calories)} kcal</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-4 text-xs text-text-secondary border-t border-outline-subtle pt-2">
              <span>{Math.round(totals.calories)} kcal</span>
              <span>B {Math.round(totals.protein_g)}g</span>
              <span>S {Math.round(totals.carbs_g)}g</span>
              <span>T {Math.round(totals.fat_g)}g</span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Wire the route** — in `App.tsx` replace the `/nutrition/plan` placeholder with `<Route path="/nutrition/plan" element={<Plan />} />` and add `import Plan from './pages/nutrition/Plan'`.

- [ ] **Step 7: Write a render test**

`webapp/src/pages/nutrition/plan.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import Plan from './Plan'

vi.mock('../../nutrition/hooks', () => ({
  useActiveMealPlan: () => ({
    isLoading: false,
    data: {
      id: 'p', name: 'Cutting plan', description: null, valid_from: null, valid_to: null,
      meals: [{ id: 'm1', meal_plan_id: 'p', name: 'Breakfast', time_of_day: '08:00', sort_order: 0, day_of_week: null,
        meal_foods: [{ id: 'f1', meal_id: 'm1', name: 'Oats', amount_grams: 80, calories: 300, protein_g: 10, carbs_g: 50, fat_g: 6 }] }],
    },
  }),
}))

test('Plan shows plan name and a meal with its food', () => {
  render(<Plan />)
  expect(screen.getByText('Cutting plan')).toBeInTheDocument()
  expect(screen.getByText('Breakfast')).toBeInTheDocument()
  expect(screen.getByText('Oats')).toBeInTheDocument()
})
```

- [ ] **Step 8: Run tests + build**

Run: `cd webapp && npm test -- src/nutrition/mealPlan.test.ts src/pages/nutrition/plan.test.tsx && npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 9: Commit**

```bash
cd .. && git add -f webapp/src/nutrition/mealPlan.ts webapp/src/nutrition/mealPlan.test.ts webapp/src/pages/nutrition/Plan.tsx webapp/src/pages/nutrition/plan.test.tsx webapp/src/App.tsx
git commit -m "feat(webapp): meal plan screen with day selector"
```

---

### Task 13: Recipes list + detail

Recipe browsing with a favorites filter, and a detail view with ingredients + steps. Deliverable: `/nutrition/recipes` and `/nutrition/recipes/:id` render live data; favorite toggling works.

**Files:**
- Create: `webapp/src/pages/nutrition/Recipes.tsx`, `webapp/src/pages/nutrition/RecipeDetail.tsx`, `webapp/src/pages/nutrition/recipes.test.tsx`
- Modify: `webapp/src/App.tsx`

**Interfaces:**
- Consumes: `useRecipes`, `useRecipe`, `useFavorites`, `useToggleFavorite`, `Card`, `Chip`, `SectionHeader`, `EmptyState`, `Shimmer`, `lucide-react` (`Heart`).
- Produces: default-exported `Recipes`, `RecipeDetail`.

- [ ] **Step 1: Create the Recipes list**

`webapp/src/pages/nutrition/Recipes.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useRecipes, useFavorites } from '../../nutrition/hooks'
import { useToggleFavorite } from '../../nutrition/mutations'
import { Card, Chip, SectionHeader, EmptyState, Shimmer } from '../../components/ui'

export default function Recipes() {
  const navigate = useNavigate()
  const { data: recipes, isLoading } = useRecipes()
  const { data: favorites } = useFavorites()
  const toggle = useToggleFavorite()
  const [onlyFavs, setOnlyFavs] = useState(false)

  if (isLoading) return <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <Shimmer key={i} className="h-28 w-full" />)}</div>

  const favSet = favorites ?? new Set<string>()
  const list = (recipes ?? [])
    .filter(r => !onlyFavs || favSet.has(r.id))
    .sort((a, b) => Number(b.featured) - Number(a.featured))

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Recepty" action={<Chip selected={onlyFavs} onClick={() => setOnlyFavs(v => !v)}>Obľúbené</Chip>} />
      {list.length === 0 && <EmptyState title="Žiadne recepty" />}
      {list.map(r => {
        const isFav = favSet.has(r.id)
        return (
          <Card key={r.id} className="flex gap-3 cursor-pointer" onClick={() => navigate(`/nutrition/recipes/${r.id}`)}>
            {r.photo_url && <img src={r.photo_url} alt={r.name} className="w-20 h-20 object-cover rounded-lg" />}
            <div className="flex-1">
              <p className="font-semibold text-text-primary">{r.name}</p>
              <p className="text-xs text-text-secondary">{Math.round(r.calories)} kcal · B {Math.round(r.protein_g)}g</p>
            </div>
            <button
              aria-label="favorite"
              onClick={e => { e.stopPropagation(); toggle.mutate({ recipeId: r.id, isFavorite: isFav }) }}
              className="self-start p-1"
            >
              <Heart size={20} className={isFav ? 'fill-accent text-accent' : 'text-text-secondary'} />
            </button>
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create the Recipe detail**

`webapp/src/pages/nutrition/RecipeDetail.tsx`:
```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useRecipe } from '../../nutrition/hooks'
import { Card, StatRow, EmptyState, Shimmer } from '../../components/ui'

export default function RecipeDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: recipe, isLoading } = useRecipe(id)

  if (isLoading) return <Shimmer className="h-64 w-full" />
  if (!recipe) return <EmptyState title="Recept sa nenašiel" />

  const ingredients = recipe.recipe_ingredients ?? []
  const steps = (recipe.recipe_steps ?? []).slice().sort((a, b) => a.step_number - b.step_number)

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-text-secondary">
        <ChevronLeft size={16} /> Späť
      </button>
      {recipe.photo_url && <img src={recipe.photo_url} alt={recipe.name} className="w-full h-52 object-cover rounded-2xl" />}
      <h1 className="text-xl font-bold text-text-primary">{recipe.name}</h1>
      {recipe.description && <p className="text-sm text-text-secondary">{recipe.description}</p>}

      <Card>
        <StatRow items={[
          { label: 'Kcal', value: String(Math.round(recipe.calories)) },
          { label: 'Bielk.', value: `${Math.round(recipe.protein_g)}g` },
          { label: 'Sach.', value: `${Math.round(recipe.carbs_g)}g` },
          { label: 'Tuky', value: `${Math.round(recipe.fat_g)}g` },
        ]} />
      </Card>

      {ingredients.length > 0 && (
        <section>
          <h2 className="font-bold text-text-primary mb-2">Ingrediencie</h2>
          <ul className="flex flex-col gap-1">
            {ingredients.map(i => (
              <li key={i.id} className="flex justify-between text-sm">
                <span className="text-text-primary">{i.name}</span>
                <span className="text-text-secondary">{i.quantity ?? ''} {i.unit ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {steps.length > 0 && (
        <section>
          <h2 className="font-bold text-text-primary mb-2">Postup</h2>
          <ol className="flex flex-col gap-3">
            {steps.map(s => (
              <li key={s.id} className="flex gap-3 text-sm">
                <span className="ds-metric-sm text-accent">{s.step_number}</span>
                <span className="text-text-primary pt-1">{s.instruction}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire routes** — in `App.tsx` replace the `/nutrition/recipes` placeholder and add the detail route:
```tsx
<Route path="/nutrition/recipes" element={<Recipes />} />
<Route path="/nutrition/recipes/:id" element={<RecipeDetail />} />
```
Add imports: `import Recipes from './pages/nutrition/Recipes'` and `import RecipeDetail from './pages/nutrition/RecipeDetail'`.

- [ ] **Step 4: Write a render test**

`webapp/src/pages/nutrition/recipes.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Recipes from './Recipes'

const toggleMutate = vi.fn()
vi.mock('../../nutrition/hooks', () => ({
  useRecipes: () => ({ isLoading: false, data: [
    { id: 'r1', name: 'Protein oats', calories: 350, protein_g: 30, carbs_g: 40, fat_g: 8, photo_url: null, featured: true, tags: [], servings: 1, difficulty: null, description: null, prep_time_min: null, cook_time_min: null },
  ] }),
  useFavorites: () => ({ data: new Set<string>() }),
}))
vi.mock('../../nutrition/mutations', () => ({ useToggleFavorite: () => ({ mutate: toggleMutate }) }))

test('Recipes lists a recipe and toggles favorite without navigating', async () => {
  render(<MemoryRouter><Recipes /></MemoryRouter>)
  expect(screen.getByText('Protein oats')).toBeInTheDocument()
  await userEvent.click(screen.getByLabelText('favorite'))
  expect(toggleMutate).toHaveBeenCalledWith({ recipeId: 'r1', isFavorite: false })
})
```

- [ ] **Step 5: Run tests + build**

Run: `cd webapp && npm test -- src/pages/nutrition/recipes.test.tsx && npm run build`
Expected: pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
cd .. && git add -f webapp/src/pages/nutrition/Recipes.tsx webapp/src/pages/nutrition/RecipeDetail.tsx webapp/src/pages/nutrition/recipes.test.tsx webapp/src/App.tsx
git commit -m "feat(webapp): recipes list + detail with favorites"
```

---

### Task 14: Meal history list + detail

Past logged meals grouped by date with totals, plus a per-log detail. Deliverable: `/nutrition/history` and `/nutrition/history/:id` render live data.

**Files:**
- Create: `webapp/src/nutrition/history.ts`, `webapp/src/nutrition/history.test.ts`, `webapp/src/pages/nutrition/History.tsx`, `webapp/src/pages/nutrition/HistoryDetail.tsx`, `webapp/src/pages/nutrition/history.test.tsx`
- Modify: `webapp/src/App.tsx`

**Interfaces:**
- Consumes: `useMealHistory`, `sumMacros`, `Card`, `EmptyState`, `Shimmer`, `MealLogRow`.
- Produces:
  - `groupByDay(logs: MealLogRow[]): Array<{ date: string; logs: MealLogRow[] }>` — groups by `logged_at` calendar day (UTC), newest day first
  - default-exported `History`, `HistoryDetail`.

- [ ] **Step 1: Write the failing grouping test**

`webapp/src/nutrition/history.test.ts`:
```ts
import { groupByDay } from './history'
import type { MealLogRow } from '../types/database'

const log = (id: string, iso: string): MealLogRow => ({
  id, user_id: 'u', meal_name: id, notes: null, image_url: null, logged_at: iso, meal_log_foods: [],
})

test('groups logs by calendar day, newest first', () => {
  const groups = groupByDay([
    log('a', '2026-07-10T09:00:00Z'),
    log('b', '2026-07-10T19:00:00Z'),
    log('c', '2026-07-09T12:00:00Z'),
  ])
  expect(groups.map(g => g.date)).toEqual(['2026-07-10', '2026-07-09'])
  expect(groups[0].logs.map(l => l.id)).toEqual(['a', 'b'])
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd webapp && npm test -- src/nutrition/history.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `history.ts`**

`webapp/src/nutrition/history.ts`:
```ts
import type { MealLogRow } from '../types/database'

export function groupByDay(logs: MealLogRow[]): Array<{ date: string; logs: MealLogRow[] }> {
  const map = new Map<string, MealLogRow[]>()
  for (const l of logs) {
    const day = l.logged_at.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(l)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, dayLogs]) => ({ date, logs: dayLogs }))
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/nutrition/history.test.ts`
Expected: PASS.

- [ ] **Step 5: Create History + HistoryDetail screens**

`webapp/src/pages/nutrition/History.tsx`:
```tsx
import { useNavigate } from 'react-router-dom'
import { useMealHistory } from '../../nutrition/hooks'
import { groupByDay } from '../../nutrition/history'
import { sumMacros } from '../../nutrition/calc'
import { Card, SectionHeader, EmptyState, Shimmer } from '../../components/ui'

export default function History() {
  const navigate = useNavigate()
  const { data: logs, isLoading } = useMealHistory()

  if (isLoading) return <div className="flex flex-col gap-3">{[0, 1].map(i => <Shimmer key={i} className="h-20 w-full" />)}</div>
  const groups = groupByDay(logs ?? [])
  if (groups.length === 0) return <EmptyState title="Zatiaľ žiadne záznamy" message="Tvoje zapísané jedlá sa zobrazia tu." />

  return (
    <div className="flex flex-col gap-6">
      {groups.map(g => (
        <section key={g.date}>
          <SectionHeader title={g.date} />
          <div className="flex flex-col gap-2">
            {g.logs.map(l => {
              const t = sumMacros(l.meal_log_foods)
              return (
                <Card key={l.id} className="flex justify-between cursor-pointer" onClick={() => navigate(`/nutrition/history/${l.id}`)}>
                  <div>
                    <p className="font-semibold text-text-primary">{l.meal_name}</p>
                    <p className="text-xs text-text-secondary">{new Date(l.logged_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="ds-metric-sm text-text-primary self-center">{Math.round(t.calories)}</span>
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
```

`webapp/src/pages/nutrition/HistoryDetail.tsx`:
```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useMealHistory } from '../../nutrition/hooks'
import { sumMacros } from '../../nutrition/calc'
import { Card, StatRow, EmptyState, Shimmer } from '../../components/ui'

export default function HistoryDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: logs, isLoading } = useMealHistory()

  if (isLoading) return <Shimmer className="h-64 w-full" />
  const log = (logs ?? []).find(l => l.id === id)
  if (!log) return <EmptyState title="Záznam sa nenašiel" />
  const t = sumMacros(log.meal_log_foods)

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-text-secondary">
        <ChevronLeft size={16} /> Späť
      </button>
      <h1 className="text-xl font-bold text-text-primary">{log.meal_name}</h1>
      <Card>
        <StatRow items={[
          { label: 'Kcal', value: String(Math.round(t.calories)) },
          { label: 'Bielk.', value: `${Math.round(t.protein_g)}g` },
          { label: 'Sach.', value: `${Math.round(t.carbs_g)}g` },
          { label: 'Tuky', value: `${Math.round(t.fat_g)}g` },
        ]} />
      </Card>
      <ul className="flex flex-col gap-1">
        {log.meal_log_foods.map(f => (
          <li key={f.id} className="flex justify-between text-sm">
            <span className="text-text-primary">{f.name}</span>
            <span className="text-text-secondary">{Math.round(f.amount)} {f.unit} · {Math.round(f.calories)} kcal</span>
          </li>
        ))}
      </ul>
      {log.notes && <p className="text-sm text-text-secondary">{log.notes}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Wire routes** — in `App.tsx` replace the `/nutrition/history` placeholder and add detail:
```tsx
<Route path="/nutrition/history" element={<History />} />
<Route path="/nutrition/history/:id" element={<HistoryDetail />} />
```
Add imports for `History` and `HistoryDetail`.

- [ ] **Step 7: Write a render test**

`webapp/src/pages/nutrition/history.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import History from './History'

vi.mock('../../nutrition/hooks', () => ({
  useMealHistory: () => ({ isLoading: false, data: [
    { id: 'l1', user_id: 'u', meal_name: 'Obed', notes: null, image_url: null, logged_at: '2026-07-10T11:00:00Z',
      meal_log_foods: [{ id: 'f', meal_log_id: 'l1', name: 'Rice', amount: 150, unit: 'g', amount_grams: 150, calories: 200, protein_g: 4, carbs_g: 44, fat_g: 1 }] },
  ] }),
}))

test('History groups a logged meal under its date', () => {
  render(<MemoryRouter><History /></MemoryRouter>)
  expect(screen.getByText('2026-07-10')).toBeInTheDocument()
  expect(screen.getByText('Obed')).toBeInTheDocument()
  expect(screen.getByText('200')).toBeInTheDocument()
})
```

- [ ] **Step 8: Run tests + build**

Run: `cd webapp && npm test -- src/nutrition/history.test.ts src/pages/nutrition/history.test.tsx && npm run build`
Expected: pass; build succeeds.

- [ ] **Step 9: Commit**

```bash
cd .. && git add -f webapp/src/nutrition/history.ts webapp/src/nutrition/history.test.ts webapp/src/pages/nutrition/History.tsx webapp/src/pages/nutrition/HistoryDetail.tsx webapp/src/pages/nutrition/history.test.tsx webapp/src/App.tsx
git commit -m "feat(webapp): meal history list + detail"
```

---

### Task 15: Log-a-meal flow

The daily loop's write path: search foods, add each with a portion, name the meal, save. Deliverable: `/nutrition/log` logs a meal and returns to the Hub with the summary updated.

**Files:**
- Create: `webapp/src/pages/nutrition/LogMeal.tsx`, `webapp/src/pages/nutrition/logMeal.test.tsx`
- Modify: `webapp/src/App.tsx`

**Interfaces:**
- Consumes: `useFoodSearch`, `useLogMeal`, `scaleFood`, `Input`, `Button`, `Card`, `Shimmer`, `LogFoodInput`, `FoodRow`.
- Produces: default-exported `LogMeal`.

- [ ] **Step 1: Create the Log-meal screen**

`webapp/src/pages/nutrition/LogMeal.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useFoodSearch } from '../../nutrition/hooks'
import { useLogMeal, type LogFoodInput } from '../../nutrition/mutations'
import { scaleFood } from '../../nutrition/calc'
import type { FoodRow } from '../../types/database'
import { Input, Button, Card, Shimmer } from '../../components/ui'

export default function LogMeal() {
  const navigate = useNavigate()
  const [mealName, setMealName] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<LogFoodInput[]>([])
  const { data: results, isFetching } = useFoodSearch(query)
  const logMeal = useLogMeal()

  function addFood(food: FoodRow) {
    const scaled = scaleFood(food, food.serving_size)
    setItems(prev => [...prev, {
      name: scaled.name, amount: scaled.amount, unit: scaled.unit,
      calories: scaled.calories, protein_g: scaled.protein_g, carbs_g: scaled.carbs_g, fat_g: scaled.fat_g,
    }])
    setQuery('')
  }

  function setAmount(index: number, amount: number) {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it
      // Rescale macros by the ratio of the new amount to the current amount.
      const ratio = it.amount > 0 ? amount / it.amount : 0
      return {
        ...it, amount,
        calories: it.calories * ratio, protein_g: it.protein_g * ratio,
        carbs_g: it.carbs_g * ratio, fat_g: it.fat_g * ratio,
      }
    }))
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  async function save() {
    if (!mealName || items.length === 0) return
    await logMeal.mutateAsync({ mealName, foods: items })
    navigate('/nutrition')
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-text-primary">Zapísať jedlo</h1>
      <Input id="mealName" label="Názov jedla" placeholder="napr. Obed" value={mealName} onChange={e => setMealName(e.target.value)} />

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <Card key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-text-primary">{it.name}</span>
              <input
                type="number" min={0} value={Math.round(it.amount)}
                onChange={e => setAmount(i, Number(e.target.value))}
                className="w-20 h-9 px-2 rounded-lg bg-surface border border-outline text-text-primary text-sm outline-none"
              />
              <span className="text-xs text-text-secondary w-6">{it.unit}</span>
              <span className="text-xs text-text-secondary w-16 text-right">{Math.round(it.calories)} kcal</span>
              <button aria-label="remove" onClick={() => removeItem(i)} className="text-text-secondary"><X size={16} /></button>
            </Card>
          ))}
        </div>
      )}

      <Input id="foodSearch" label="Pridať potravinu" placeholder="Hľadať…" value={query} onChange={e => setQuery(e.target.value)} />
      {isFetching && <Shimmer className="h-10 w-full" />}
      {(results ?? []).length > 0 && (
        <Card className="flex flex-col divide-y divide-outline-subtle p-0 overflow-hidden">
          {results!.map(f => (
            <button key={f.id} onClick={() => addFood(f)} className="flex justify-between items-center px-4 py-3 text-left">
              <span className="text-sm text-text-primary">{f.name}{f.brand ? ` · ${f.brand}` : ''}</span>
              <span className="text-xs text-text-secondary">{Math.round(f.calories)} kcal / {Math.round(f.serving_size)}{f.serving_unit}</span>
            </button>
          ))}
        </Card>
      )}

      <Button className="w-full" loading={logMeal.isPending} disabled={!mealName || items.length === 0} onClick={save}>
        Uložiť jedlo
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire the route** — in `App.tsx`, inside the `AppShell` route group add:
```tsx
<Route path="/nutrition/log" element={<LogMeal />} />
```
Add `import LogMeal from './pages/nutrition/LogMeal'`.

- [ ] **Step 3: Write a flow test**

`webapp/src/pages/nutrition/logMeal.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LogMeal from './LogMeal'

const mutateAsync = vi.fn().mockResolvedValue(undefined)
vi.mock('../../nutrition/hooks', () => ({
  useFoodSearch: () => ({ isFetching: false, data: [
    { id: 'f1', name: 'Rice', calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, serving_size: 100, serving_unit: 'g', brand: null, is_verified: true },
  ] }),
}))
vi.mock('../../nutrition/mutations', () => ({ useLogMeal: () => ({ mutateAsync, isPending: false }) }))

test('add a food, name the meal, and save', async () => {
  render(<MemoryRouter><LogMeal /></MemoryRouter>)
  await userEvent.type(screen.getByLabelText('Názov jedla'), 'Obed')
  await userEvent.click(screen.getByText(/Rice/))
  await userEvent.click(screen.getByRole('button', { name: 'Uložiť jedlo' }))
  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
    mealName: 'Obed',
    foods: [expect.objectContaining({ name: 'Rice', amount: 100, unit: 'g', calories: 130 })],
  }))
})
```

- [ ] **Step 4: Run tests + build**

Run: `cd webapp && npm test -- src/pages/nutrition/logMeal.test.tsx && npm run build`
Expected: pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
cd .. && git add -f webapp/src/pages/nutrition/LogMeal.tsx webapp/src/pages/nutrition/logMeal.test.tsx webapp/src/App.tsx
git commit -m "feat(webapp): log-a-meal flow (search + portion + save)"
```

---

### Task 16: Integration polish, route transitions, README

Final wiring pass: framer-motion route transitions, a full test+build gate, and a deploy README. Deliverable: whole suite green, production build clean, docs for Netlify.

**Files:**
- Create: `webapp/src/components/PageTransition.tsx`, `webapp/README.md`
- Modify: `webapp/src/components/AppShell.tsx` (wrap `<Outlet />` in the transition)

**Interfaces:**
- Consumes: `framer-motion`, `react-router-dom` (`useLocation`, `Outlet`).
- Produces: `PageTransition()` wrapping the routed content.

- [ ] **Step 1: Create the transition wrapper**

`webapp/src/components/PageTransition.tsx`:
```tsx
import { motion } from 'framer-motion'
import { useLocation, Outlet } from 'react-router-dom'

export function PageTransition() {
  const location = useLocation()
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Outlet />
    </motion.div>
  )
}
```

- [ ] **Step 2: Nest the transition in `AppShell`** — in `AppShell.tsx`, replace `<Outlet />` inside `<main>` with `<PageTransition />` and add `import { PageTransition } from './PageTransition'`. (`PageTransition` renders the real `<Outlet />`.)

- [ ] **Step 3: Write the deploy README**

`webapp/README.md`:
```markdown
# Coach Foska — User Web App

Mobile-first client web app (Nutrition MVP). React + Vite + Tailwind + Supabase.

## Local dev
```bash
cd webapp
npm install
cp ../admin/.env .env   # same Supabase project + anon key
npm run dev
```

## Test / build
```bash
npm test
npm run build
```

## Deploy (Netlify)
- New Netlify site, base directory `webapp`, build `npm run build`, publish `webapp/dist`.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same values as the admin site).
- SPA redirect + security headers are in `webapp/netlify.toml`.

## Scope
Nutrition only: meal plan, recipes (+favorites), daily macro summary vs targets, history, and meal logging. Email-OTP auth. No backend changes — all data via existing Supabase tables + RLS.
```

- [ ] **Step 4: Full gate — run the entire suite and a clean build**

Run: `cd webapp && npm test && npm run build`
Expected: ALL tests pass; build succeeds with no TypeScript errors.

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run: `npm run dev`, open the local URL, sign in with a real client email + OTP, and verify: Today shows rings, Plan shows the assigned plan, Recipes list + favorite toggle, log a meal → Today calories increase, History shows the new log.

- [ ] **Step 6: Commit**

```bash
cd .. && git add -f webapp/src/components/PageTransition.tsx webapp/src/components/AppShell.tsx webapp/README.md
git commit -m "feat(webapp): route transitions + deploy README; integration gate"
```

---

## Self-Review

**Spec coverage:**
- §2/§3 stack + `webapp/` layout → Task 1. ✓
- §4 design tokens (colors/type/shape/spacing) → Task 2. ✓
- §4.4 primitives → Tasks 3–4 (core + data/MacroRing). ✓
- §5 app shell + IA/routes → Task 5 (shell), Tasks 7/11–15 (routes). ✓
- §6.1 reads (meal plan, recipes, recipe, history, daily, food search, favorites) → Task 9. ✓
- §6.2 writes (log meal w/ dual amount_grams, toggle favorite) → Task 10. ✓
- §6.3 daily summary client-computed → Task 9 `useDailySummary`. ✓
- §6.4 macro-target formula → Task 8 `calcMacroTargets`. ✓
- §7 email-OTP auth + guard → Task 7. ✓
- §8 responsive/phone-width column + framer-motion + shimmer → Tasks 5, 11–15, 16. ✓
- §9 tests (portion math, summing, targets, hooks, screen smokes) → Tasks 8, 9, 10, 11–15. ✓
- §10 out-of-scope respected: no backend/photo/barcode/other tabs. ✓

**Placeholder scan:** No TBD/TODO; every code step carries full code. The `Placeholder.tsx` component (Task 7) is intentional temporary scaffolding, replaced route-by-route in Tasks 11–15. ✓

**Type consistency:** `Macros` (Task 8) is reused by hooks/mutations/screens. `LogFoodInput` (Task 10) matches `LogMeal` usage (Task 15). `qk` keys (Task 9) are the same referenced in mutations (Task 10). `todayIso` is defined once in `date.ts` (Task 11) and imported by mutations. `mealsForDay`, `groupByDay`, `dashOffset`, `scaleFood`, `sumMacros`, `calcMacroTargets` signatures match their call sites. ✓

**Note for the executor (assumption to verify at runtime, spec §11):** confirm RLS lets an authenticated non-admin user read `foods`, `recipes`, assigned `meal_plans` (via `user_meal_plans`), and read/write their own `meal_logs`/`meal_log_foods`/`recipe_favorites`. If a read returns empty or a write 403s, that's an RLS policy gap to raise (do NOT weaken policies without confirming intent). This is the one thing tests can't prove because they mock supabase.
