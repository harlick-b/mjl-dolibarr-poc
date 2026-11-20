import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Pagination } from './Pagination'

test('uses one accessible previous and next control contract', async () => {
  const user = userEvent.setup()
  const onPrevious = vi.fn()
  const onNext = vi.fn()
  render(
    <Pagination
      label="Pagination des activités"
      canPrevious={false}
      canNext
      onPrevious={onPrevious}
      onNext={onNext}
    />,
  )

  const navigation = screen.getByRole('navigation', {
    name: 'Pagination des activités',
  })
  expect(navigation.querySelector('button:first-of-type')).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Suivant' }))
  expect(onNext).toHaveBeenCalledOnce()
  expect(onPrevious).not.toHaveBeenCalled()
})

test('hides pagination when neither direction exists', () => {
  render(
    <Pagination
      label="Pagination vide"
      canPrevious={false}
      canNext={false}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
    />,
  )
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})
