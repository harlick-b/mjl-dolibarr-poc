import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  requiredFieldFeedbackHandlers,
  requiredFieldFeedbackStyles,
  missingRequiredFieldProps,
} from './required-field-feedback'

function RequiredEmail() {
  return (
    <form {...requiredFieldFeedbackHandlers}>
      <label>
        Adresse e-mail *
        <input aria-label="Adresse e-mail" type="email" required />
      </label>
    </form>
  )
}

describe('required field feedback', () => {
  it('marks only an empty required field and clears the marker after entry', () => {
    render(<RequiredEmail />)
    const input = screen.getByLabelText('Adresse e-mail')

    fireEvent.invalid(input)
    expect(input).toHaveAttribute('data-value-missing', 'true')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(requiredFieldFeedbackStyles.join(' ')).toContain(
      'Ce_champ_est_obligatoire.',
    )

    fireEvent.change(input, { target: { value: 'incorrect' } })
    expect(input).not.toHaveAttribute('data-value-missing')

    fireEvent.invalid(input)
    expect(input).not.toHaveAttribute('data-value-missing')
  })

  it('provides the same marker for controlled custom fields', () => {
    expect(missingRequiredFieldProps(true)).toEqual({
      'data-value-missing': 'true',
      'aria-invalid': 'true',
    })
    expect(missingRequiredFieldProps(false)).toEqual({})
  })
})
