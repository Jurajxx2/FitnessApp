import { useId } from 'react'
import { Input } from './ui'
import { ALLERGEN_OPTIONS, DIETARY_PATTERN_OPTIONS, type VocabOption } from '../nutrition/constants'
import type { UserNutritionPreferences } from '../types/database'

interface Copy {
  meals: string; threeMeals: string; oneSnack: string; mealHint: string
  patterns: string; allergens: string; maxPrep: string; maxRepeats: string
}
const COPY: Record<'sk' | 'en', Copy> = {
  en: {
    meals: 'Daily meal structure', threeMeals: '3 main meals', oneSnack: '3 main meals + 1 snack',
    mealHint: 'Generated plans currently support one snack slot per day.',
    patterns: 'Dietary patterns',
    allergens: 'Excluded allergens', maxPrep: 'Max prep + cook time (min)', maxRepeats: 'Max recipe repeats per week',
  },
  sk: {
    meals: 'Denná štruktúra jedál', threeMeals: '3 hlavné jedlá', oneSnack: '3 hlavné jedlá + 1 desiata',
    mealHint: 'Generovaný jedálniček momentálne podporuje jednu desiatu denne.',
    patterns: 'Stravovacie preferencie',
    allergens: 'Vylúčené alergény', maxPrep: 'Max. čas prípravy (min)', maxRepeats: 'Max. opakovaní receptu za týždeň',
  },
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value]
}

function ChipGroup({ options, selected, onToggle, locale }: {
  options: VocabOption[]; selected: string[]; onToggle: (value: string) => void; locale: 'sk' | 'en'
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const active = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(option.value)}
            className={`min-h-9 cursor-pointer rounded-xl border px-3 text-xs font-semibold transition-colors ${active ? 'border-accent bg-accent/10 text-text-primary' : 'border-outline bg-surface text-text-secondary hover:text-text-primary'}`}
          >
            {locale === 'sk' ? option.label : option.adminLabel}
          </button>
        )
      })}
    </div>
  )
}

export function NutritionPreferencesForm({ value, onChange, locale }: {
  value: UserNutritionPreferences
  onChange: (next: UserNutritionPreferences) => void
  locale: 'sk' | 'en'
}) {
  const copy = COPY[locale]
  const mealsId = useId()
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={mealsId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">{copy.meals}</label>
          <select
            id={mealsId}
            className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary"
            value={value.meals_per_day >= 4 ? 4 : 3}
            onChange={event => {
              const includeSnack = Number(event.target.value) === 4
              onChange({ ...value, include_snack: includeSnack, meals_per_day: includeSnack ? 4 : 3 })
            }}
          >
            <option value={3}>{copy.threeMeals}</option>
            <option value={4}>{copy.oneSnack}</option>
          </select>
          <p className="mt-1.5 text-xs leading-5 text-text-secondary">{copy.mealHint}</p>
        </div>
        <Input
          label={copy.maxPrep} type="number" min="1"
          value={value.max_prep_time_min == null ? '' : String(value.max_prep_time_min)}
          onChange={event => onChange({ ...value, max_prep_time_min: event.target.value ? Number(event.target.value) : null })}
        />
        <Input
          label={copy.maxRepeats} type="number" min="0"
          value={String(value.max_recipe_repeats_per_week)}
          onChange={event => onChange({ ...value, max_recipe_repeats_per_week: Math.max(0, Number(event.target.value)) })}
        />
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">{copy.patterns}</p>
        <ChipGroup options={DIETARY_PATTERN_OPTIONS} selected={value.dietary_patterns} locale={locale}
          onToggle={pattern => onChange({ ...value, dietary_patterns: toggle(value.dietary_patterns, pattern) })} />
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">{copy.allergens}</p>
        <ChipGroup options={ALLERGEN_OPTIONS} selected={value.excluded_allergens} locale={locale}
          onToggle={allergen => onChange({ ...value, excluded_allergens: toggle(value.excluded_allergens, allergen) })} />
      </div>
    </div>
  )
}
