import { dashOffset } from './ring'

const C = 100

test('empty ring shows full offset (no arc drawn)', () => {
  expect(dashOffset(0, C)).toBe(100)
})
test('full ring shows zero offset (complete arc)', () => {
  expect(dashOffset(1, C)).toBe(0)
})
test('half ring shows half offset', () => {
  expect(dashOffset(0.5, C)).toBe(50)
})
test('over-target clamps to full arc', () => {
  expect(dashOffset(1.7, C)).toBe(0)
})
