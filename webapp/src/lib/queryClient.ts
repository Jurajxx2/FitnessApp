import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { logger } from './logger'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error('React Query request failed', {
        queryHash: query.queryHash,
        error,
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      logger.error('React Query mutation failed', {
        mutationKey: mutation.options.mutationKey,
        error,
      })
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,        // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
      throwOnError: false,
    },
    mutations: {
      retry: 0,
      throwOnError: false,
    },
  },
})
