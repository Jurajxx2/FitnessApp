import { useQuery } from '@tanstack/react-query'
import { fetchActiveQuote, quoteKeys } from './queries'

export function useActiveQuote() {
  return useQuery({
    queryKey: quoteKeys.active,
    queryFn: fetchActiveQuote,
    staleTime: 60 * 60 * 1000,
  })
}
