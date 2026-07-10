/** Stroke-dashoffset for a ring where `fraction` (0..1+) of the circle is filled.
 *  offset = circumference * (1 - clampedFraction). */
export function dashOffset(fraction: number, circumference: number): number {
  const f = Math.max(0, Math.min(1, fraction))
  return circumference * (1 - f)
}
