import {
  BODY_REGIONS,
  BODY_VIEWBOX_WIDTH,
  BODY_VIEWBOX_HEIGHT,
  BODY_BACK_OFFSET_X,
  type FocusGroup,
} from './bodyRegions'

/**
 * Read-only anatomical figure that highlights a user's selected focus areas.
 * Mirrors the in-app BodyMapSelector (same MIT path data) so admins see exactly what the
 * user picked. Front + back are shown side by side. `focus_areas` values are the lowercase
 * MuscleGroup names ('chest', 'back', …, or 'full_body').
 */
export function BodyFocusMap({
  focusAreas,
  className,
}: {
  focusAreas: string[]
  className?: string
}) {
  const set = new Set(focusAreas.map((a) => a.toLowerCase()))
  const allOn = set.has('full_body')
  const isOn = (g: FocusGroup | null) => g !== null && (allOn || set.has(g))

  return (
    <div className={className} style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      <BodySide view="front" isOn={isOn} />
      <BodySide view="back" isOn={isOn} />
    </div>
  )
}

function BodySide({
  view,
  isOn,
}: {
  view: 'front' | 'back'
  isOn: (g: FocusGroup | null) => boolean
}) {
  const minX = view === 'front' ? 0 : BODY_BACK_OFFSET_X
  const viewBox = `${minX} 0 ${BODY_VIEWBOX_WIDTH} ${BODY_VIEWBOX_HEIGHT}`
  const regions = BODY_REGIONS.filter((r) => r.view === view)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg
        viewBox={viewBox}
        style={{ width: '100%', maxWidth: 130, height: 'auto' }}
        role="img"
        aria-label={`${view} body focus areas`}
      >
        {regions.flatMap((r, ri) =>
          r.paths.map((d, pi) => {
            const on = isOn(r.group)
            // Tiers mirror the app: faint silhouette < visible base < bright selected.
            const fillOpacity = r.group === null ? 0.08 : on ? 0.95 : 0.18
            return (
              <path
                key={`${ri}-${pi}`}
                d={d}
                fill="var(--text)"
                fillOpacity={fillOpacity}
                stroke="var(--text)"
                strokeOpacity={0.35}
                strokeWidth={1.5}
              />
            )
          }),
        )}
      </svg>
      <span
        className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]"
        style={{ letterSpacing: '0.1em' }}
      >
        {view}
      </span>
    </div>
  )
}
