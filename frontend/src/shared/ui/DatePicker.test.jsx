import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { DatePicker } from './DatePicker'

function Harness() {
  const [value, setValue] = useState('')
  return <DatePicker label="Début" value={value} onChange={setValue} />
}

test('accepts a date from the native keyboard-friendly field', () => {
  render(<Harness />)

  fireEvent.click(screen.getByRole('button', { name: /Début/ }))
  fireEvent.change(screen.getByLabelText('Début'), {
    target: { value: '2027-02-03' },
  })

  expect(
    screen.getByRole('button', { name: 'Début : 3 février 2027' }),
  ).toBeInTheDocument()
  expect(screen.queryByLabelText('Début')).not.toBeInTheDocument()
})
