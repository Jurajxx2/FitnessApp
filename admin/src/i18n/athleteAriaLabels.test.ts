import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  ATHLETE_SOURCE_ROOTS,
  extractAriaLabelLiterals,
  findUntranslatedAriaLabels,
  isUntranslatedAriaLabel,
} from './athleteAriaLabels'

// import.meta.url is an http URL under the jsdom environment, so the tree is located
// from the working directory instead — `npm test` runs in admin/, but tolerate a run
// rooted at the repository.
const SRC_DIR = existsSync(join(process.cwd(), 'src/i18n'))
  ? join(process.cwd(), 'src')
  : join(process.cwd(), 'admin/src')

function filesUnder(root: string): string[] {
  const absolute = join(SRC_DIR, root)
  // statSync throws on a missing path on purpose: if a directory is renamed the guard
  // must fail loudly rather than quietly stop covering it.
  if (statSync(absolute).isFile()) return [absolute]
  return readdirSync(absolute, { recursive: true, encoding: 'utf8' })
    .map(entry => join(absolute, entry))
    .filter(path => statSync(path).isFile())
}

const athleteSources = ATHLETE_SOURCE_ROOTS.flatMap(filesUnder)
  .filter(path => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
  .map(path => ({ path: relative(SRC_DIR, path), source: readFileSync(path, 'utf8') }))

describe('extractAriaLabelLiterals', () => {
  it('reads a plain string attribute', () => {
    expect(extractAriaLabelLiterals('<button aria-label="Close panel" />')).toEqual([
      { text: 'Close panel', line: 1 },
    ])
  })

  it('joins the static chunks of a template literal into one label', () => {
    expect(extractAriaLabelLiterals('<input aria-label={`Séria ${n} RPE`} />')).toEqual([
      { text: 'Séria  RPE', line: 1 },
    ])
  })

  it('reads both branches of a ternary and any literal inside an interpolation', () => {
    const source = "<b aria-label={fav ? `Odobrať ${item || 'položku'}` : 'Pridať'} />"

    expect(extractAriaLabelLiterals(source).map(literal => literal.text))
      .toEqual(['Odobrať ', 'položku', 'Pridať'])
  })

  it('yields nothing for a bare expression, which is locale-driven by construction', () => {
    expect(extractAriaLabelLiterals('<button aria-label={copy.close} />')).toEqual([])
  })

  it('reports the line the literal sits on', () => {
    const source = ['const a = 1', '', '<button aria-label="Close menu" />'].join('\n')

    expect(extractAriaLabelLiterals(source)).toEqual([{ text: 'Close menu', line: 3 }])
  })
})

describe('isUntranslatedAriaLabel', () => {
  it('flags ASCII-only copy', () => {
    expect(isUntranslatedAriaLabel('Close panel')).toBe(true)
  })

  it('accepts copy carrying a diacritic', () => {
    expect(isUntranslatedAriaLabel('Zavrieť panel')).toBe(false)
  })

  it('ignores statics that are only punctuation between interpolations', () => {
    expect(isUntranslatedAriaLabel(': ')).toBe(false)
  })
})

describe('athlete aria-labels', () => {
  it('covers every athlete source root', () => {
    expect(athleteSources.length).toBeGreaterThan(15)
  })

  it('finds enough labels that a broken extractor cannot pass vacuously', () => {
    const total = athleteSources.reduce(
      (count, file) => count + extractAriaLabelLiterals(file.source).length,
      0,
    )

    expect(total).toBeGreaterThan(15)
  })

  it('are all localized — the athlete app is Slovak-only', () => {
    const offenders = athleteSources.flatMap(file =>
      findUntranslatedAriaLabels(file.source).map(
        literal => `${file.path}:${literal.line} — aria-label "${literal.text}"`,
      ),
    )

    expect(offenders).toEqual([])
  })
})
