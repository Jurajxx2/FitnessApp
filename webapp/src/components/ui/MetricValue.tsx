export function MetricValue({ value, label, size = 'md' }: { value: string; label?: string; size?: 'lg' | 'md' | 'sm' }) {
  const cls = size === 'lg' ? 'ds-metric-lg' : size === 'sm' ? 'ds-metric-sm' : 'ds-metric-md'
  return (
    <div className="flex flex-col items-center">
      <span className={`${cls} text-text-primary`}>{value}</span>
      {label && <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>}
    </div>
  )
}
