import { render } from '@testing-library/react'

test('semantic token utility classes apply without error', () => {
  const { container } = render(
    <div className="bg-surface text-primary">
      <span className="ds-metric-lg text-accent">1234</span>
    </div>
  )
  expect(container.querySelector('.ds-metric-lg')).toBeInTheDocument()
  expect(container.querySelector('.bg-surface')).toBeInTheDocument()
})
