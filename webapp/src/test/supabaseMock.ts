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
