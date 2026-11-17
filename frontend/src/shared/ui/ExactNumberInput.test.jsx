import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { ExactNumberInput } from './ExactNumberInput'

function Harness({ scale = 0, initial = '' }) {
  const [value, setValue] = useState(initial)
  return (
    <ExactNumberInput
      aria-label="Montant"
      name="amount"
      value={value}
      onChange={setValue}
      scale={scale}
      suffix={scale ? '%' : 'F CFA'}
    />
  )
}

test('keeps an exact amount while presenting French digit grouping', async () => {
  const user = userEvent.setup()
  render(<Harness initial="2000000" />)
  const input = screen.getByRole('textbox', { name: 'Montant' })
  expect(input).toHaveValue('2 000 000')

  await user.click(input)
  expect(input).toHaveValue('2000000')
  await user.clear(input)
  await user.type(input, '500000')
  await user.tab()
  expect(input).toHaveValue('500 000')
  expect(document.querySelector('input[name="amount"]')).toHaveValue('500000')
})

test('accepts a French decimal separator for percentages', async () => {
  const user = userEvent.setup()
  render(<Harness scale={2} />)
  const input = screen.getByRole('textbox', { name: 'Montant' })
  await user.type(input, '33,33')
  await user.tab()
  expect(input).toHaveValue('33,33')
  expect(document.querySelector('input[name="amount"]')).toHaveValue('33.33')
})
