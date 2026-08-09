// The athlete app is Slovak-only, but an English `aria-label` is invisible to visual
// review — it never renders, it only reaches screen-reader users. Three of them slipped
// through a hand-enforced pass across sixteen tasks, so the check is automated here and
// asserted over the real tree by athleteAriaLabels.test.ts.
//
// Heuristic: Slovak copy of any length virtually always carries a diacritic, so an
// aria-label literal that has ASCII letters and *no* non-ASCII character is treated as
// untranslated English. Genuinely diacritic-free Slovak goes in ALLOWED_ASCII_LABELS.
//
// Only athlete-exclusive sources are scanned. Components shared with the coach app
// (MealPhoto, LogTypeToggle, ExercisePicker, NutritionPreferencesForm, ui/*) cannot be
// blanket-Slovak — they take a `locale` prop instead, as Modal, ConfirmDialog and
// SlideOver do.

/** Paths relative to `src/`, each a directory to walk or a single file. */
export const ATHLETE_SOURCE_ROOTS = [
  'activity',
  'checkins',
  'nutrition',
  'quotes',
  'pages/activity',
  'pages/checkins',
  'pages/nutrition',
  'pages/Messages.tsx',
  'pages/Profile.tsx',
  'components/AthleteAppShell.tsx',
  'components/AthletePageTransition.tsx',
] as const

/**
 * Exact literals that are Slovak (or locale-neutral) despite being pure ASCII.
 * Add sparingly, with the source file in the comment — every entry is a hole in the guard.
 */
export const ALLOWED_ASCII_LABELS: readonly string[] = []

export interface AriaLabelLiteral {
  text: string
  line: number
}

interface RawLiteral {
  text: string
  index: number
}

/** Reads the `'…'` or `"…"` literal starting at `start`, honouring backslash escapes. */
function readQuoted(source: string, start: number): { value: string; end: number } {
  const quote = source[start]
  let value = ''
  let i = start + 1
  while (i < source.length) {
    const char = source[i]
    if (char === '\\') {
      value += source[i + 1] ?? ''
      i += 2
      continue
    }
    if (char === quote) return { value, end: i + 1 }
    value += char
    i += 1
  }
  return { value, end: i }
}

/**
 * Reads the template literal starting at `start`. The static chunks are joined into a
 * single value — `` `Séria ${n} RPE` `` has to be judged as one label, not as the two
 * fragments "Séria " and " RPE" — and the `${…}` holes are reported for separate scanning.
 */
function readTemplate(
  source: string,
  start: number,
): { value: string; end: number; holes: Array<{ start: number; end: number }> } {
  let value = ''
  const holes: Array<{ start: number; end: number }> = []
  let i = start + 1
  while (i < source.length) {
    const char = source[i]
    if (char === '\\') {
      value += source[i + 1] ?? ''
      i += 2
      continue
    }
    if (char === '`') return { value, end: i + 1, holes }
    if (char === '$' && source[i + 1] === '{') {
      const close = findMatchingBrace(source, i + 1)
      holes.push({ start: i + 2, end: close })
      i = close + 1
      continue
    }
    value += char
    i += 1
  }
  return { value, end: i, holes }
}

/** Index of the `}` closing the `{` at `openIndex`, skipping over nested literals. */
function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0
  let i = openIndex
  while (i < source.length) {
    const char = source[i]
    if (char === '"' || char === "'") {
      i = readQuoted(source, i).end
      continue
    }
    if (char === '`') {
      i = readTemplate(source, i).end
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return i
    }
    i += 1
  }
  return source.length
}

/** Every string and template literal in `source[start, end)`, including inside `${…}`. */
function collectLiterals(source: string, start: number, end: number): RawLiteral[] {
  const found: RawLiteral[] = []
  let i = start
  while (i < end) {
    const char = source[i]
    if (char === '"' || char === "'") {
      const quoted = readQuoted(source, i)
      found.push({ text: quoted.value, index: i })
      i = quoted.end
      continue
    }
    if (char === '`') {
      const template = readTemplate(source, i)
      found.push({ text: template.value, index: i })
      for (const hole of template.holes) {
        found.push(...collectLiterals(source, hole.start, hole.end))
      }
      i = template.end
      continue
    }
    i += 1
  }
  return found
}

function lineOf(source: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i += 1) if (source[i] === '\n') line += 1
  return line
}

/**
 * Every literal reachable from an `aria-label` attribute. A bare expression
 * (`aria-label={copy.close}`) yields nothing — it is locale-driven by construction —
 * while a ternary yields both branches.
 */
export function extractAriaLabelLiterals(source: string): AriaLabelLiteral[] {
  const raw: RawLiteral[] = []
  for (const match of source.matchAll(/aria-label\s*=\s*/g)) {
    const at = match.index + match[0].length
    const char = source[at]
    if (char === '"' || char === "'") {
      raw.push({ text: readQuoted(source, at).value, index: at })
    } else if (char === '{') {
      raw.push(...collectLiterals(source, at + 1, findMatchingBrace(source, at)))
    }
  }
  return raw.map(literal => ({ text: literal.text, line: lineOf(source, literal.index) }))
}

/** True when the literal reads as untranslated English rather than Slovak copy. */
export function isUntranslatedAriaLabel(text: string): boolean {
  if (ALLOWED_ASCII_LABELS.includes(text)) return false
  // Punctuation-and-interpolation-only statics (`${copy.details}: ${name}`) carry no copy.
  if (!/[A-Za-z]/.test(text)) return false
  return isPureAscii(text)
}

/** Any character above U+007F means the copy has been localized. */
function isPureAscii(text: string): boolean {
  for (const char of text) if (char.codePointAt(0)! > 0x7f) return false
  return true
}

export function findUntranslatedAriaLabels(source: string): AriaLabelLiteral[] {
  return extractAriaLabelLiterals(source).filter(literal => isUntranslatedAriaLabel(literal.text))
}
