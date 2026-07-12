import { cn } from '../../lib/cn'

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-surface-highest rounded-lg', className)} />
}
