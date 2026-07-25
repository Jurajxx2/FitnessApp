import { dashOffset } from '../../lib/ring'

export function MacroRing({ label, value, target, unit, size = 96 }: {
  label: string; value: number; target?: number; unit: string; size?: number
}) {
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const fraction = target && target > 0 ? value / target : 0
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block -rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--outline-subtle)" strokeWidth={stroke} />
          {target && target > 0 && (
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-strong)" strokeWidth={stroke}
              strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dashOffset(fraction, c)}
            />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="ds-metric-sm text-text-primary">{Math.round(value)}</span>
          {target ? <span className="text-[10px] leading-3 text-text-secondary">/ {Math.round(target)}{unit}</span>
                  : <span className="text-[10px] leading-3 text-text-secondary">{unit}</span>}
        </div>
      </div>
      <span className="ledger-label text-text-secondary">{label}</span>
    </div>
  )
}
