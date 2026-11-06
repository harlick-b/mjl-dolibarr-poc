import { fireEvent, screen } from '@testing-library/react'

export async function selectOption(control, label) {
  fireEvent.keyDown(control, { key: 'ArrowDown' })
  fireEvent.click(
    await screen.findByRole('option', { name: label, exact: true }),
  )
}
