import { Card, Shimmer } from '../components/ui'
import { useActiveQuote } from './hooks'

/**
 * The coach's active daily quote, shared by every athlete home surface so the
 * nutrition and activity hubs cannot drift apart. It is decoration: when no
 * quote is active — or the query fails — it renders nothing rather than
 * occupying the top of the page with an error.
 */
export function DailyQuoteCard() {
  const { data: quote, isLoading } = useActiveQuote()

  if (isLoading) return <Shimmer className="h-20 w-full" />
  if (!quote) return null

  return (
    <Card className="p-5 sm:p-6">
      <p className="italic text-text-primary">{quote.text}</p>
      {quote.author && <p className="mt-2 text-sm text-text-secondary">— {quote.author}</p>}
    </Card>
  )
}
