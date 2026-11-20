import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BusinessForm } from './BusinessForm'
import {
  requiredFieldFeedbackHandlers,
  requiredFieldFeedbackStyles,
  missingRequiredFieldProps,
} from './required-field-feedback'
import { RequiredFieldError } from './RequiredFieldError'

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
    expect(requiredFieldFeedbackStyles.join(' ')).toContain('border-danger')

    fireEvent.change(input, { target: { value: 'incorrect' } })
    expect(input).not.toHaveAttribute('data-value-missing')

    fireEvent.invalid(input)
    expect(input).not.toHaveAttribute('data-value-missing')
  })

  it('provides the same marker for controlled custom fields', () => {
    expect(missingRequiredFieldProps(true, 'activity-name-error')).toEqual({
      'data-value-missing': 'true',
      'aria-invalid': 'true',
      'aria-describedby': 'activity-name-error',
    })
    expect(missingRequiredFieldProps(false)).toEqual({})
  })

  it('renders a real linked error message only while the field is invalid', () => {
    const { rerender } = render(
      <label>
        Intitulé *
        <input
          aria-label="Intitulé"
          {...missingRequiredFieldProps(true, 'activity-name-error')}
        />
        <RequiredFieldError id="activity-name-error" show />
      </label>,
    )

    const input = screen.getByLabelText('Intitulé')
    const error = screen.getByText('Ce champ est obligatoire.')
    expect(input).toHaveAttribute('aria-describedby', error.id)
    expect(error).toHaveAttribute('role', 'alert')

    rerender(
      <label>
        Intitulé *
        <input
          aria-label="Intitulé"
          {...missingRequiredFieldProps(false, 'activity-name-error')}
        />
        <RequiredFieldError id="activity-name-error" show={false} />
      </label>,
    )
    expect(screen.queryByText('Ce champ est obligatoire.')).toBeNull()
  })

  it('links native required fields to a real message through the shared form', () => {
    render(
      <BusinessForm onSubmit={() => false}>
        <label>
          Adresse e-mail *
          <input aria-label="Adresse e-mail" required />
        </label>
      </BusinessForm>,
    )
    const input = screen.getByLabelText('Adresse e-mail')

    fireEvent.invalid(input)

    const error = screen.getByText('Ce champ est obligatoire.')
    expect(input).toHaveAttribute('aria-describedby', error.id)

    fireEvent.change(input, { target: { value: 'agent@example.test' } })
    expect(screen.queryByText('Ce champ est obligatoire.')).toBeNull()
    expect(input).not.toHaveAttribute('aria-describedby')
  })
})
