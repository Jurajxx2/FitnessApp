import { dashOffset } from '../../lib/ring'

export function MacroRing({ label, value, target, unit, size = 96 }: {
  label: string; value: number; target?: number; unit: string; size?: number
}) {
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const fraction = target && target > 0 ? value / target : 0
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--outline-subtle)" strokeWidth={stroke} />
        {target && target > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dashOffset(fraction, c)}
          />
        )}
      </svg>
      <div className="-mt-[62%] flex flex-col items-center pointer-events-none">
        <span className="ds-metric-sm text-text-primary">{Math.round(value)}</span>
        {target ? <span className="text-[10px] text-text-secondary">/ {Math.round(target)}{unit}</span>
                : <span className="text-[10px] text-text-secondary">{unit}</span>}
      </div>
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>
    </div>
  )
}
