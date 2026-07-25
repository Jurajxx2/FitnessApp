export function StatRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="flex justify-around">
      {items.map(it => (
        <div key={it.label} className="flex flex-col items-center gap-1">
          <span className="ds-metric-sm text-text-primary">{it.value}</span>
          <span className="ledger-label text-text-secondary">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
