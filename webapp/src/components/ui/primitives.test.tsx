import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, Chip, Input, SectionHeader, EmptyState } from './index'

test('Button disables when loading', () => {
  render(<Button loading>Save</Button>)
  expect(screen.getByRole('button')).toBeDisabled()
})

test('Chip fires onClick', async () => {
  const onClick = vi.fn()
  render(<Chip onClick={onClick}>All</Chip>)
  await userEvent.click(screen.getByRole('button', { name: 'All' }))
  expect(onClick).toHaveBeenCalledOnce()
})

test('Input renders its label', () => {
  render(<Input id="email" label="Email address" />)
  expect(screen.getByText('Email address')).toBeInTheDocument()
})

test('SectionHeader + EmptyState render text', () => {
  render(<><SectionHeader title="Recipes" /><EmptyState title="Nothing here" message="Try later" /></>)
  expect(screen.getByText('Recipes')).toBeInTheDocument()
  expect(screen.getByText('Nothing here')).toBeInTheDocument()
})
