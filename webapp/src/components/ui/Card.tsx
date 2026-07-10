import React from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('bg-surface-elevated rounded-2xl p-4 border border-outline-subtle', className)} />
}
