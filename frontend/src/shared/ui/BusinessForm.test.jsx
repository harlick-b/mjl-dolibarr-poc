import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { BusinessForm } from './BusinessForm'
import { Button } from './button'

test.each([
  ['Retourner', 'Autoriser'],
  ['Autoriser', 'Retourner'],
])(
  'only the %s submit button shows its loading state',
  async (activeLabel, idleLabel) => {
    const user = userEvent.setup()
    let finish
    const pending = new Promise((resolve) => {
      finish = resolve
    })
    render(
      <BusinessForm onSubmit={() => pending}>
        <Button type="button" variant="outline">
          Annuler
        </Button>
        <Button type="submit" value="return">
          Retourner
        </Button>
        <Button type="submit" value="approve">
          Autoriser
        </Button>
      </BusinessForm>,
    )

    const cancel = screen.getByRole('button', { name: 'Annuler' })
    const activeButton = screen.getByRole('button', { name: activeLabel })
    const idleButton = screen.getByRole('button', { name: idleLabel })
    await user.click(activeButton)

    await waitFor(() =>
      expect(activeButton).toHaveAttribute('aria-busy', 'true'),
    )
    expect(activeButton.querySelector('.animate-spin')).toBeVisible()
    expect(idleButton).not.toHaveAttribute('aria-busy', 'true')
    expect(idleButton.querySelector('.animate-spin')).toBeNull()
    expect(cancel).not.toHaveAttribute('aria-busy', 'true')
    expect(cancel.querySelector('.animate-spin')).toBeNull()

    await act(async () => finish(true))
    await waitFor(() =>
      expect(activeButton).not.toHaveAttribute('aria-busy', 'true'),
    )
  },
)
