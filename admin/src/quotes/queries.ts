import { supabase } from '../lib/supabase'
import type { DailyQuote } from '../types/database'

export const quoteKeys = {
  active: ['activeQuote'] as const,
}

export type ActiveQuote = Pick<DailyQuote, 'id' | 'text' | 'author'>

/**
 * The single quote the coach has activated, or null when none is. Readable by
 * any authenticated athlete under the "Authenticated users read quotes" policy.
 */
export async function fetchActiveQuote(): Promise<ActiveQuote | null> {
  const { data, error } = await supabase
    .from('daily_quotes')
    .select('id, text, author')
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data
}
