// Stable EN keys stored in the DB; Slovak labels for athlete-facing UI,
// English labels for the admin surface.
export interface VocabOption {
  value: string
  label: string      // Slovak (athlete surface)
  adminLabel: string // English (admin surface)
}

export const DIETARY_PATTERN_OPTIONS: VocabOption[] = [
  { value: 'vegetarian', label: 'Vegetariánska', adminLabel: 'Vegetarian' },
  { value: 'vegan', label: 'Vegánska', adminLabel: 'Vegan' },
  { value: 'gluten_free', label: 'Bezlepková', adminLabel: 'Gluten-free' },
  { value: 'lactose_free', label: 'Bez laktózy', adminLabel: 'Lactose-free' },
  { value: 'low_carb', label: 'Nízkosacharidová', adminLabel: 'Low-carb' },
  { value: 'high_protein', label: 'Vysokoproteínová', adminLabel: 'High-protein' },
]

export const ALLERGEN_OPTIONS: VocabOption[] = [
  { value: 'gluten', label: 'Lepok', adminLabel: 'Gluten' },
  { value: 'lactose', label: 'Laktóza', adminLabel: 'Lactose' },
  { value: 'eggs', label: 'Vajcia', adminLabel: 'Eggs' },
  { value: 'nuts', label: 'Orechy', adminLabel: 'Nuts' },
  { value: 'peanuts', label: 'Arašidy', adminLabel: 'Peanuts' },
  { value: 'soy', label: 'Sója', adminLabel: 'Soy' },
  { value: 'fish', label: 'Ryby', adminLabel: 'Fish' },
  { value: 'shellfish', label: 'Kôrovce', adminLabel: 'Shellfish' },
  { value: 'sesame', label: 'Sezam', adminLabel: 'Sesame' },
  { value: 'celery', label: 'Zeler', adminLabel: 'Celery' },
  { value: 'mustard', label: 'Horčica', adminLabel: 'Mustard' },
]

export const MEAL_TYPE_OPTIONS: VocabOption[] = [
  { value: 'breakfast', label: 'Raňajky', adminLabel: 'Breakfast' },
  { value: 'lunch', label: 'Obed', adminLabel: 'Lunch' },
  { value: 'dinner', label: 'Večera', adminLabel: 'Dinner' },
  { value: 'snack', label: 'Desiata', adminLabel: 'Snack' },
]
